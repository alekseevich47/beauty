import { BeautyWidget } from './beauty-widget';

if (!customElements.get('beauty-widget')) {
  customElements.define('beauty-widget', BeautyWidget);
}

export { BeautyWidget };
