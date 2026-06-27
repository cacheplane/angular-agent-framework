export type ThreadplaneNodeEvent =
  | 'tplane:postinstall'
  | 'tplane:runtime_instance_created'
  | 'tplane:runtime_request_created'
  | 'tplane:stream_started'
  | 'tplane:stream_ended'
  | 'tplane:stream_errored';

export type ThreadplaneBrowserEvent =
  | 'tplane:browser_provided'
  | 'tplane:browser_chat_init';

export type ThreadplaneEvent = ThreadplaneNodeEvent | ThreadplaneBrowserEvent;
