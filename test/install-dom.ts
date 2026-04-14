import { JSDOM } from "jsdom";

export function installTestDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const { window } = dom;
  const globalObject = globalThis as typeof globalThis &
    Record<string, unknown>;

  const previousValues = {
    window: globalObject.window,
    document: globalObject.document,
    navigator: globalObject.navigator,
    HTMLElement: globalObject.HTMLElement,
    Element: globalObject.Element,
    Node: globalObject.Node,
    Event: globalObject.Event,
    MouseEvent: globalObject.MouseEvent,
    PointerEvent: globalObject.PointerEvent,
    KeyboardEvent: globalObject.KeyboardEvent,
    MutationObserver: globalObject.MutationObserver,
    DOMRect: globalObject.DOMRect,
    getComputedStyle: globalObject.getComputedStyle,
    requestAnimationFrame: globalObject.requestAnimationFrame,
    cancelAnimationFrame: globalObject.cancelAnimationFrame,
    ResizeObserver: globalObject.ResizeObserver,
  };

  globalObject.window = window as unknown as Window & typeof globalThis;
  globalObject.document = window.document;
  globalObject.navigator = window.navigator;
  globalObject.HTMLElement = window.HTMLElement;
  globalObject.Element = window.Element;
  globalObject.Node = window.Node;
  globalObject.Event = window.Event;
  globalObject.MouseEvent = window.MouseEvent;
  globalObject.PointerEvent = window.PointerEvent ?? window.MouseEvent;
  globalObject.KeyboardEvent = window.KeyboardEvent;
  globalObject.MutationObserver = window.MutationObserver;
  globalObject.DOMRect = window.DOMRect;
  globalObject.getComputedStyle = window.getComputedStyle.bind(window);
  globalObject.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    window.setTimeout(
      () => callback(Date.now()),
      0,
    )) as typeof requestAnimationFrame;
  globalObject.cancelAnimationFrame = ((id: number) =>
    window.clearTimeout(id)) as typeof cancelAnimationFrame;
  globalObject.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }

  return () => {
    for (const [key, value] of Object.entries(previousValues)) {
      if (typeof value === "undefined") {
        delete globalObject[key];
      } else {
        globalObject[key] = value;
      }
    }

    dom.window.close();
  };
}
