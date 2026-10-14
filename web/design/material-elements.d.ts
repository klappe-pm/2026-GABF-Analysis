// JSX types for the Material web components the site uses (registered in web/design/runtime.tsx).
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type MdProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [attribute: string]: unknown;
};

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MdProps;
      'md-filled-tonal-button': MdProps;
      'md-elevated-button': MdProps;
      'md-outlined-button': MdProps;
      'md-text-button': MdProps;
      'md-checkbox': MdProps;
      'md-chip-set': MdProps;
      'md-assist-chip': MdProps;
      'md-input-chip': MdProps;
      'md-dialog': MdProps;
      'md-divider': MdProps;
      'md-elevation': MdProps;
      'md-focus-ring': MdProps;
      'md-linear-progress': MdProps;
      'md-circular-progress': MdProps;
      'md-outlined-select': MdProps;
      'md-filled-select': MdProps;
      'md-select-option': MdProps;
      'md-outlined-text-field': MdProps;
      'md-filled-text-field': MdProps;
      'md-tabs': MdProps;
      'md-primary-tab': MdProps;
      'md-outlined-card': MdProps;
    }
  }
}
