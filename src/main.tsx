import React from 'react';
import ReactDOM from 'react-dom';
import DemoApp from './demo/DemoApp';
import DataDemo from './demo/DataDemo';

// `?demo=data` opens the `data` prop demo instead of the file demo.
const Demo = new URLSearchParams(window.location.search).get('demo') === 'data' ? DataDemo : DemoApp;

ReactDOM.render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
  document.getElementById('root')
);
