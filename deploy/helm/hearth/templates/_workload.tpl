{{- define "hearth.replicas" -}}
{{- $w := .w | default dict }}
{{- if kindIs "invalid" $w.replicas }}1{{ else }}{{ $w.replicas | int }}{{ end }}
{{- end }}

{{- define "hearth.appPod" -}}
{{- $root := .root }}
{{- $w := .w | default dict }}
{{- $readsSecret := and (not .noEnvFrom) (not .configMapOnly) }}
{{- $env := .env | default list }}
{{- if and $readsSecret $root.Values.valkey.enabled }}
{{- $env = prepend $env (dict "name" "FLUXER_KV_URL" "value" "redis://:$(FLUXER_VALKEY_PASSWORD)@valkey:6379/0") }}
{{- end }}
metadata:
  labels:
    {{- include "hearth.podLabels" . | nindent 4 }}
  annotations:
    checksum/instance: {{ include "hearth.instanceChecksum" $root }}
    {{- with $w.podAnnotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
spec:
  automountServiceAccountToken: false
  enableServiceLinks: false
  {{- include "hearth.pullSecrets" $root | nindent 2 }}
  securityContext:
    {{- include "hearth.podSecurityContext" (dict) | nindent 4 }}
  {{- include "hearth.scheduling" . | nindent 2 }}
  {{- with $w.terminationGracePeriodSeconds }}
  terminationGracePeriodSeconds: {{ . }}
  {{- end }}
  {{- include "hearth.waitFor" . | nindent 2 }}
  containers:
    - name: {{ .containerName | default .name }}
      image: {{ include "hearth.image" . }}
      imagePullPolicy: {{ include "hearth.pullPolicy" . }}
      {{- with .command }}
      command:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with include "hearth.envList" (dict "w" $w "env" $env) }}
      env:
        {{- . | nindent 8 }}
      {{- end }}
      {{- if not .noEnvFrom }}
      envFrom:
        {{- if .configMapOnly }}
        - configMapRef:
            name: {{ .configMapOnly }}
        {{- else }}
        - configMapRef:
            name: hearth-config
        - secretRef:
            name: {{ include "hearth.secretName" $root }}
        {{- end }}
      {{- end }}
      ports:
        - name: http
          containerPort: {{ .port }}
          protocol: TCP
        {{- range .extraPorts }}
        - name: {{ .name }}
          containerPort: {{ .port }}
          protocol: TCP
        {{- end }}
      {{- with include "hearth.probes" . | trim }}
      {{- . | nindent 6 }}
      {{- end }}
      {{- with .lifecycle }}
      lifecycle:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $w.resources }}
      resources:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      securityContext:
        {{- include "hearth.containerSecurityContext" . | nindent 8 }}
      {{- with concat (.volumeMounts | default list) ($w.extraVolumeMounts | default list) }}
      volumeMounts:
        {{- toYaml . | nindent 8 }}
      {{- end }}
  {{- with concat (.volumes | default list) ($w.extraVolumes | default list) }}
  volumes:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end }}

{{- define "hearth.app" -}}
{{- $root := .root }}
{{- $w := .w | default dict }}
---
apiVersion: apps/v1
kind: {{ .kind | default "Deployment" }}
metadata:
  name: {{ .name }}
  namespace: {{ $root.Release.Namespace }}
  labels:
    {{- include "hearth.labels" . | nindent 4 }}
spec:
  {{- if not (and $w.hpa $w.hpa.maxReplicas) }}
  replicas: {{ include "hearth.replicas" . }}
  {{- end }}
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      {{- include "hearth.selectorLabels" . | nindent 6 }}
  {{- if eq (.kind | default "Deployment") "StatefulSet" }}
  serviceName: {{ .serviceName }}
  podManagementPolicy: Parallel
  {{- else if .strategy }}
  strategy:
    {{- toYaml .strategy | nindent 4 }}
  {{- end }}
  template:
    {{- include "hearth.appPod" . | nindent 4 }}
{{- if not .noService }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ .name }}
  namespace: {{ $root.Release.Namespace }}
  labels:
    {{- include "hearth.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  {{- if .headless }}
  clusterIP: None
  publishNotReadyAddresses: true
  {{- end }}
  selector:
    {{- include "hearth.selectorLabels" . | nindent 4 }}
  ports:
    - name: http
      port: {{ .servicePort | default .port }}
      targetPort: http
      protocol: TCP
{{- end }}
{{- with $w.pdb }}
{{- if or (not (kindIs "invalid" .minAvailable)) (not (kindIs "invalid" .maxUnavailable)) }}
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ $.name }}
  namespace: {{ $root.Release.Namespace }}
  labels:
    {{- include "hearth.labels" $ | nindent 4 }}
spec:
  {{- if not (kindIs "invalid" .minAvailable) }}
  minAvailable: {{ .minAvailable }}
  {{- end }}
  {{- if not (kindIs "invalid" .maxUnavailable) }}
  maxUnavailable: {{ .maxUnavailable }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "hearth.selectorLabels" $ | nindent 6 }}
{{- end }}
{{- end }}
{{- with $w.hpa }}
{{- if .maxReplicas }}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ $.name }}
  namespace: {{ $root.Release.Namespace }}
  labels:
    {{- include "hearth.labels" $ | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: {{ $.kind | default "Deployment" }}
    name: {{ $.name }}
  minReplicas: {{ .minReplicas | default 1 }}
  maxReplicas: {{ .maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .targetCPUUtilizationPercentage | default 80 }}
{{- end }}
{{- end }}
{{- end }}
