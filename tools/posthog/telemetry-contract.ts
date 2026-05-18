export const TELEMETRY_FORBIDDEN_PROPERTIES = [
  'apiUrl',
  'assistantId',
  'error',
  'errorMessage',
  'messages',
  'prompt',
  'query',
  'threadId',
] as const;

export const NGAF_RUNTIME_EVENTS = [
  'ngaf:runtime_instance_created',
  'ngaf:runtime_request_created',
  'ngaf:stream_started',
  'ngaf:stream_ended',
  'ngaf:stream_errored',
] as const;

type TelemetryEventContract = {
  requiredProperties: readonly string[];
  allowedProperties: readonly string[];
  allowedBreakdowns: readonly string[];
};

const installProperties = [
  'arch',
  'global_install',
  'install_context',
  'node',
  'node_version',
  'os',
  'package_manager',
  'package_manager_arch',
  'package_manager_node_version',
  'package_manager_os',
  'package_manager_version',
  'package_manager_workspaces',
  'pkg',
  'sample_weight',
  'version',
] as const;

const runtimeProperties = [
  'durationMs',
  'errorClass',
  'model',
  'provider',
  'requestType',
  'sample_weight',
  'surface',
  'transport',
] as const;

const ctaProperties = [
  'cta_id',
  'cta_text',
  'destination_url',
  'source_page',
  'source_section',
  'surface',
  'track',
] as const;

const cockpitShellProperties = [
  'capability',
  'category',
  'file_path',
  'from_capability',
  'from_mode',
  'surface',
  'to_mode',
] as const;

export const TELEMETRY_EVENT_CONTRACT: Record<string, TelemetryEventContract> =
  {
    $pageview: {
      requiredProperties: [],
      allowedProperties: ['$pathname', 'title'],
      allowedBreakdowns: ['$pathname'],
    },
    'cockpit:activation_complete': {
      requiredProperties: ['capability'],
      allowedProperties: ['capability'],
      allowedBreakdowns: ['capability'],
    },
    'cockpit:chat_first_message': {
      requiredProperties: ['capability'],
      allowedProperties: ['capability'],
      allowedBreakdowns: ['capability'],
    },
    'cockpit:code_copied': {
      requiredProperties: ['capability'],
      allowedProperties: cockpitShellProperties,
      allowedBreakdowns: ['capability', 'surface'],
    },
    'cockpit:generative_component_rendered': {
      requiredProperties: ['capability'],
      allowedProperties: ['capability'],
      allowedBreakdowns: ['capability'],
    },
    'cockpit:interrupt_handled': {
      requiredProperties: ['capability'],
      allowedProperties: ['capability'],
      allowedBreakdowns: ['capability'],
    },
    'cockpit:mode_switched': {
      requiredProperties: ['capability'],
      allowedProperties: cockpitShellProperties,
      allowedBreakdowns: ['capability', 'from_mode', 'to_mode'],
    },
    'cockpit:recipe_opened': {
      requiredProperties: ['capability'],
      allowedProperties: cockpitShellProperties,
      allowedBreakdowns: ['capability', 'category', 'from_capability'],
    },
    'cockpit:thread_persisted': {
      requiredProperties: ['capability'],
      allowedProperties: ['capability'],
      allowedBreakdowns: ['capability'],
    },
    'cockpit:transport_connected': {
      requiredProperties: ['capability'],
      allowedProperties: ['capability'],
      allowedBreakdowns: ['capability'],
    },
    'marketing:cta_click': {
      requiredProperties: ['cta_id'],
      allowedProperties: ctaProperties,
      allowedBreakdowns: [
        'cta_id',
        'source_page',
        'source_section',
        'surface',
        'track',
      ],
    },
    'ngaf:browser_chat_init': {
      requiredProperties: ['surface'],
      allowedProperties: runtimeProperties,
      allowedBreakdowns: ['surface'],
    },
    'ngaf:browser_provided': {
      requiredProperties: [],
      allowedProperties: runtimeProperties,
      allowedBreakdowns: ['surface'],
    },
    'ngaf:postinstall': {
      requiredProperties: ['pkg', 'version'],
      allowedProperties: installProperties,
      allowedBreakdowns: [
        'global_install',
        'install_context',
        'os',
        'package_manager',
        'package_manager_os',
        'package_manager_workspaces',
        'pkg',
      ],
    },
    'ngaf:runtime_instance_created': {
      requiredProperties: ['transport'],
      allowedProperties: runtimeProperties,
      allowedBreakdowns: [
        'model',
        'provider',
        'requestType',
        'surface',
        'transport',
      ],
    },
    'ngaf:runtime_request_created': {
      requiredProperties: ['transport'],
      allowedProperties: runtimeProperties,
      allowedBreakdowns: [
        'model',
        'provider',
        'requestType',
        'surface',
        'transport',
      ],
    },
    'ngaf:stream_started': {
      requiredProperties: ['transport'],
      allowedProperties: runtimeProperties,
      allowedBreakdowns: [
        'model',
        'provider',
        'requestType',
        'surface',
        'transport',
      ],
    },
    'ngaf:stream_ended': {
      requiredProperties: ['transport'],
      allowedProperties: runtimeProperties,
      allowedBreakdowns: [
        'model',
        'provider',
        'requestType',
        'surface',
        'transport',
      ],
    },
    'ngaf:stream_errored': {
      requiredProperties: ['transport'],
      allowedProperties: runtimeProperties,
      allowedBreakdowns: [
        'errorClass',
        'model',
        'provider',
        'requestType',
        'surface',
        'transport',
      ],
    },
  };
