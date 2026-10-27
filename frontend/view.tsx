import { render } from 'solid-js/web';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map/markers.css';
import './view/view.css';
import { TripView } from './view/TripView';

const root = document.getElementById('root')!;
render(() => <TripView api={root.dataset.api!} />, root);
