import { JSDOM } from 'jsdom';

// init jsdom environment for testing plugins running in browser
const dom = new JSDOM('<!DOCTYPE html><p>Hello world</p>');
global.document = dom.window.document;
global.window = dom.window;
