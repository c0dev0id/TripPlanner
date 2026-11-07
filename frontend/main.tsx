import { render } from 'solid-js/web';
import 'maplibre-gl/dist/maplibre-gl.css';
import './ui/theme.css';
import './ui/menu.css';
import './ui/lightbox.css';
import './map/baseMaps.css';
import './map/markers.css';
import './trip/journal.css';
import './styles.css';
import { App } from './App';
import { language } from './i18n/language';

document.documentElement.lang = language;
render(() => <App />, document.getElementById('root')!);
