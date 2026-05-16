export type NgafNodeEvent =
  | 'ngaf:postinstall'
  | 'ngaf:runtime_instance_created'
  | 'ngaf:runtime_request_created'
  | 'ngaf:stream_started'
  | 'ngaf:stream_ended'
  | 'ngaf:stream_errored';

export type NgafBrowserEvent =
  | 'ngaf:browser_provided'
  | 'ngaf:browser_chat_init';

export type NgafEvent = NgafNodeEvent | NgafBrowserEvent;
