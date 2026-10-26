// SPDX-License-Identifier: AGPL-3.0-or-later

package cmd

import (
	"context"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/sudo-ivan/hearth/hearthctl/internal/backup"
	"github.com/sudo-ivan/hearth/hearthctl/internal/engine"
	"github.com/sudo-ivan/hearth/hearthctl/internal/instance"
	"github.com/sudo-ivan/hearth/hearthctl/internal/release"
	"github.com/sudo-ivan/hearth/hearthctl/internal/ui"
)

type rollbackFlags struct {
	DryRun    bool
	RestoreDB bool
	Confirm   string
	Resume    string
}

func newRollbackCmd(app *App) *cobra.Command {
	var f rollbackFlags
	c := &cobra.Command{
		Use:   "rollback",
		Short: "Go back to the release you ran before the last upgrade",
		Args:  noArgs,
		RunE: func(c *cobra.Command, _ []string) error {
			return runRollback(c.Context(), app, &f)
		},
	}
	c.Flags().BoolVar(&f.DryRun, "dry-run", false, "show what would happen without changing anything")
	c.Flags().BoolVar(&f.RestoreDB, "restore-database", false, "also restore the database from the backup taken before the upgrade")
	c.Flags().StringVar(&f.Resume, release.ResumeFlag, "", "")
	_ = c.Flags().MarkHidden(release.ResumeFlag)
	confirmFlag(c, &f.Confirm)
	return c
}

func runRollback(ctx context.Context, app *App, f *rollbackFlags) error {
	inst, err := app.Instance()
	if err != nil {
		return err
	}
	if inst.State.Upgrade != nil && !f.DryRun {
		if err := managed(inst); err != nil {
			return err
		}
		if handedOver, err := updateBeforeRecovery(ctx, app, f.Resume, "", "hearthctl rollback"); err != nil || handedOver {
			return err
		}
	}
	return app.Locked(ctx, inst, func() error {
		if err := managed(inst); err != nil {
			return err
		}
		pend := inst.State.Upgrade
		interrupted := pend != nil && phaseIndex(pend.Phase) < phaseIndex(release.PhaseVerified)
		if pend != nil && !f.DryRun {
			stopped := *pend
			if err := recoverUpgrade(ctx, app, inst, false); err != nil {
				return err
			}
			if interrupted && !f.RestoreDB {
				if phaseIndex(stopped.Phase) < phaseIndex(release.PhasePulled) {
					fromShort, toShort := versionPair(stopped.From, stopped.To)
					app.UI.OK("Stopped the upgrade to Hearth %s. %s is still running.", toShort, capitalise(hearthName(fromShort)))
				}
				return nil
			}
		}
		if interrupted && f.DryRun && !f.RestoreDB {
			fromShort, toShort := versionPair(pend.From, pend.To)
			if release.Switched(pend) {
				app.UI.Info("The upgrade to Hearth %s didn't finish. hearthctl goes back to %s.", toShort, hearthName(fromShort))
			} else {
				app.UI.Info("The upgrade to Hearth %s didn't finish. hearthctl stops it, and %s keeps running.", toShort, hearthName(fromShort))
			}
			app.UI.Info("Dry run. Nothing changed.")
			return nil
		}
		var e *engine.Engine
		if f.DryRun {
			err = app.drift(inst, false, true)
		} else {
			e, err = app.guard(ctx, inst, true)
		}
		if err != nil {
			return err
		}
		cur, prev := inst.State.Release, inst.State.PreviousRelease
		if pend != nil && !interrupted && f.DryRun {
			cur, prev = pend.To, pend.From
		}
		if prev == "" && f.RestoreDB && cur != "" {
			if _, err := upgradeBackup(inst, cur); err == nil {
				return rollbackWithBackup(ctx, app, inst, e, f, cur, cur)
			}
		}
		if prev == "" && release.HasSnapshot(inst, "") {
			return ui.Refused("hearthctl can't go back to the release from before it took over this instance.", "Run hearthctl backup list, then hearthctl restore with the backup from before the upgrade.")
		}
		if prev == "" {
			return ui.Refused("There's no earlier release to go back to.", "")
		}
		curShort, prevShort := versionPair(cur, prev)
		if f.RestoreDB {
			return rollbackWithBackup(ctx, app, inst, e, f, prev, prevShort)
		}
		if !release.HasSnapshot(inst, prev) {
			return ui.Refused(fmt.Sprintf("The files for Hearth %s aren't on this machine anymore.", prevShort), "Run hearthctl rollback --restore-database to go back with the backup from before the upgrade.")
		}
		snap, err := release.SnapshotState(inst, prev)
		if err != nil {
			return ui.Wrap(err, fmt.Sprintf("Couldn't read the settings of Hearth %s.", prevShort), "Run hearthctl rollback --restore-database to go back with the backup from before the upgrade.")
		}
		if errors.Is(release.CheckPostgres(postgresRef(inst.State), postgresRef(snap)), release.ErrPostgresMajor) {
			return ui.Refused(fmt.Sprintf("Hearth %s uses a different database version than %s.", prevShort, curShort), "Run hearthctl rollback --restore-database to go back with the backup from before the upgrade.")
		}
		schemaChanged := true
		if rel, err := release.Resolve(ctx, cur); err == nil {
			schemaChanged = rel.SchemaChanged
		}
		if f.DryRun {
			app.UI.Info("Hearth goes back to %s and stops for about 2 minutes.", prevShort)
			app.UI.Info("Your database stays as it is.")
			if schemaChanged {
				app.UI.Info("Hearth %s may have changed the database in a way %s can't read.", curShort, prevShort)
			}
			app.UI.Info("Dry run. Nothing changed.")
			return nil
		}
		if schemaChanged {
			app.UI.Warn(fmt.Sprintf("Hearth %s may have changed the database in a way %s can't read.", curShort, prevShort), "If it doesn't start, run hearthctl rollback --restore-database.")
			if app.UI.Interactive() {
				restore, err := app.UI.Confirm("Restore the backup from before the upgrade too?", false)
				if err != nil {
					return err
				}
				if restore {
					return rollbackWithBackup(ctx, app, inst, e, f, prev, prevShort)
				}
			}
		}
		if !app.UI.Interactive() && !app.UI.Yes() {
			return &ui.ExitError{Code: ui.ExitUsage, Msg: fmt.Sprintf("This takes your instance back to Hearth %s. Your database stays as it is.", prevShort), Fix: "Pass --yes to go ahead."}
		}
		ok, err := app.UI.Confirm(fmt.Sprintf("Go back to Hearth %s?", prevShort), true)
		if err != nil {
			return err
		}
		if !ok {
			app.UI.Info("Nothing changed.")
			return nil
		}
		if err := release.Snapshot(inst, cur, refList(inst.State.Images.Refs)); err != nil {
			return ui.Wrap(err, fmt.Sprintf("Couldn't save the files of Hearth %s.", curShort), "Check that the disk isn't full, then run hearthctl rollback again.")
		}
		var put []string
		err = app.UI.Step(ctx, "Going back to "+prevShort, func(ctx context.Context, s *ui.Step) error {
			s.Done("Went back to %s. Your instance is running.", prevShort)
			var err error
			put, err = restoreRelease(ctx, app, inst, e, prev)
			return err
		})
		if err != nil {
			return rollbackFailed(ctx, app, inst, e, cur, prev, err)
		}
		inst.State.PreviousRelease = ""
		if err := inst.Save(); err != nil {
			return ui.Wrap(err, "Couldn't save your instance's state.", "Run hearthctl doctor to see what's wrong.")
		}
		if len(put) > 0 {
			app.UI.Info("hearthctl put back the settings Hearth %s had: %s.", prevShort, ui.JoinAnd(put))
		}
		return nil
	})
}

func rollbackFailed(ctx context.Context, app *App, inst *instance.Instance, e *engine.Engine, cur, prev string, cause error) error {
	curShort, prevShort := versionPair(cur, prev)
	logPath := writeFailureLog(ctx, inst, e.Named(inst.Project(), inst.Dir), "rollback-"+release.DirName(prev)+".log", cause, nil)
	app.UI.Fail(fmt.Sprintf("Hearth %s didn't start.", prevShort), "")
	app.UI.Detail("%v", cause)
	if ctx.Err() == nil {
		cctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), recoveryTimeout)
		defer cancel()
		_, err := restoreRelease(cctx, app, inst, e, cur)
		inst.State.Release, inst.State.PreviousRelease = cur, prev
		_ = inst.Save()
		if err == nil {
			app.UI.OK("Went back to %s. Your instance is running.", curShort)
			if logPath != "" {
				fixLine(app, fmt.Sprintf("Read %s to see why.", logPath))
			}
			app.SetExit(ui.ExitFailed)
			return nil
		}
		app.UI.Detail("%v", err)
	}
	fix := "Run hearthctl rollback --restore-database to go back with the backup from before the upgrade."
	if logPath != "" {
		fix = fmt.Sprintf("Read %s to see why, or run hearthctl rollback --restore-database to go back with the backup from before the upgrade.", logPath)
	}
	return ui.Wrap(cause, fmt.Sprintf("Couldn't start Hearth %s again either.", curShort), fix)
}

func rollbackWithBackup(ctx context.Context, app *App, inst *instance.Instance, e *engine.Engine, f *rollbackFlags, prev, prevShort string) error {
	info, err := upgradeBackup(inst, prev)
	if err != nil {
		return err
	}
	when := backupTime(info.CreatedAt)
	if f.DryRun {
		app.UI.Info("Your instance goes back to the backup from %s, on Hearth %s.", when, prevShort)
		app.UI.Info("Anything that changed since then is lost.")
		app.UI.Info("Dry run. Nothing changed.")
		return nil
	}
	what := fmt.Sprintf("This restores the backup from %s. Messages, uploads and changes since then will be lost.", when)
	if err := app.UI.ConfirmDestructive(what, inst.Domain(), f.Confirm); err != nil {
		return err
	}
	return app.UI.Step(ctx, "Restoring the backup from "+when, func(ctx context.Context, s *ui.Step) error {
		restored, err := backup.Restore(ctx, info.Path, inst.Dir, e, backup.RestoreOptions{Progress: func(stage string) {
			if t := restoreStageTitle(stage); t != "" {
				s.Title(t)
			}
		}})
		if err != nil {
			return err
		}
		if err := e.Named(restored.Project(), restored.Dir).WaitReady(ctx, readyTimeout, showReadiness(s, "Starting Hearth "+prevShort)); err != nil {
			return ui.Wrap(err, fmt.Sprintf("Restored the backup, but Hearth %s didn't start.", prevShort), "Run hearthctl doctor to see what's wrong.")
		}
		s.Done("Went back to %s with the backup from %s. Your instance is running.", prevShort, when)
		return nil
	})
}

func upgradeBackup(inst *instance.Instance, prev string) (*backup.Info, error) {
	list, err := backup.List(inst.BackupDir())
	if err != nil {
		return nil, ui.Wrap(err, "Couldn't read your backups.", "Run hearthctl backup list to see why.")
	}
	best := backup.NewestOf(list, prev)
	if best == nil {
		return nil, ui.Refused(fmt.Sprintf("There's no backup from Hearth %s on this machine.", prev), "Run hearthctl restore with a backup file you kept somewhere else.")
	}
	return best, nil
}
