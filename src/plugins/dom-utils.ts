export const enum DomStabilityStatus {
  Stable,
  Unstable,
  Unchanged
}

/**
 * Useful for bypassing preloader content.
 * @param stabilityCheck - Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds).
 * @param stabilityTimeout - Maximum waiting time (miliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).
 */
function waitForDomStability({ stabilityCheck, stabilityTimeout }:{stabilityCheck: number, stabilityTimeout: number}):Promise<DomStabilityStatus> {
  return new Promise(resolve => {
    let stabilityCheckId:number;
    let stabilityTimeoutId:number;
    let domChanged = false;

    // if this is reached, DOM is stable
    const waitStableResolve = observer => {
      window.clearTimeout(stabilityTimeoutId);
      observer.disconnect();
      resolve(domChanged ? DomStabilityStatus.Stable : DomStabilityStatus.Unchanged);
    };

    const observer = new MutationObserver((mutationList, observer) => {
      for (let i = 0; i < mutationList.length; i += 1) {
        // we only care if new nodes have been added
        if (mutationList[i].type === 'childList') {
          // restart the stabilityCheck timer
          domChanged = true;
          window.clearTimeout(stabilityCheckId);
          stabilityCheckId = window.setTimeout(waitStableResolve, stabilityCheck, observer);
          break;
        }
      }
    });

    // start stability check countdown
    stabilityCheckId = window.setTimeout(waitStableResolve, stabilityCheck, observer);

    // start observing document.body
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    // enforce stability timeout
    stabilityTimeoutId = window.setTimeout(
      () => {
        // clear in progress stability check
        window.clearTimeout(stabilityCheckId);

        observer.disconnect();
        resolve(DomStabilityStatus.Unstable);
      },
      stabilityTimeout,
    );
  });
}

export {
  waitForDomStability,
};
