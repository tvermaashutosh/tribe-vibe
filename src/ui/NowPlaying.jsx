import React from 'react';
import { ViewHeading } from './AppDisplay.jsx';

// This screen is committed by Ink before MPV takes over the terminal. That
// lets Ink replace the current app view in place, just like Play and Results.
export default function NowPlaying() {
  return <ViewHeading>Playing</ViewHeading>;
}
