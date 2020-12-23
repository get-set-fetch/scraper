/* eslint-disable import/prefer-default-export */
function waitForDomStability(stabilityCheck: number, stabilityTimeout: number):Promise<boolean> {
  return new Promise(resolve => {
    let stabilityCheckId:number;

    const waitResolve = observer => {
      observer.disconnect();
      resolve(true);
    };

    const observer = new MutationObserver((mutationList, observer) => {
      for (let i = 0; i < mutationList.length; i += 1) {
        // we only care if new nodes have been added
        if (mutationList[i].type === 'childList') {
          // restart the stabilityCheck timer
          window.clearTimeout(stabilityCheckId);
          stabilityCheckId = window.setTimeout(waitResolve, stabilityCheck, observer);
          break;
        }
      }
    });

    // start stability check countdown
    stabilityCheckId = window.setTimeout(waitResolve, stabilityCheck, observer);

    // start observing document.body
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    // enforce stability timeout
    window.setTimeout(
      () => {
        // clear in progress stability check
        window.clearTimeout(stabilityCheckId);

        observer.disconnect();
        resolve(false);
      },
      stabilityTimeout,
    );
  });
}

export {
  waitForDomStability,
};
