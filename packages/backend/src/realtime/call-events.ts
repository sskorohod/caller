import { EventEmitter } from 'events';

/** Global event bus for call transcript events — used by Telegram live transcript */
export const callEvents = new EventEmitter();
callEvents.setMaxListeners(100);
