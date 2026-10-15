// The drives a design control plane screen can run on the live page to reach its state, keyed by the
// drive name a screen node declares in design-nodes.json. product-feedback inserts this object into the
// generated screen.js, where waitFor, visible and say are defined.
{
    // The Filters button is the control just before the Filters dialog in the page header.
    'filters-open': function (doc) {
      // The dialog is a Material element: it can open only once the page has defined it.
      return waitFor(function () { var d = doc.querySelector('md-dialog[data-component="filters-dialog"]'); return d && typeof d.show === 'function' && d.previousElementSibling; }, 8000).then(function (b) {
        if (!b) { say('This state opens the Filters panel, and this page has no Filters button.'); return; }
        b.click();
        return waitFor(function () { return doc.querySelector('md-dialog[data-component="filters-dialog"][open]'); }, 4000);
      });
    },
    // An (E) mark opens its note as a native popover.
    'estimate-open': function (doc) {
      return waitFor(function () { return Array.prototype.find.call(doc.querySelectorAll('[data-component="estimate-tooltip"]'), visible); }, 15000).then(function (b) {
        if (!b) { say('This state opens an estimate note, and this page shows no (E) mark in this build.'); return; }
        b.scrollIntoView({ block: 'center' });
        b.click();
        return waitFor(function () { var p = doc.querySelector('[popover][role="note"]:popover-open'); return p; }, 6000);
      });
    },
  }
