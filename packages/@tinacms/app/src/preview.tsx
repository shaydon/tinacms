/**

*/
import React from 'react';
import { defineConfig } from 'tinacms';
import { useGraphQLReducer } from './lib/graphql-reducer';

type Config = Parameters<typeof defineConfig>[0];

export const Preview = ({
  url,
  iframeRef,
  action = 'edit',
  ...config
}: Config & {
  url: string;
  iframeRef: React.MutableRefObject<HTMLIFrameElement>;
  action: 'edit' | 'duplicate';
}) => {
  useGraphQLReducer(iframeRef, url, action);

  return (
    <iframe
      data-test='tina-iframe'
      id='tina-iframe'
      ref={iframeRef}
      className='h-screen w-full bg-white'
      src={url}
    />
  );
};
