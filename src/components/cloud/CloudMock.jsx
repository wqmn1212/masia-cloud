import React from 'react';
import { MockPlainContext } from '@/components/guide/mockKit';
import { DashMock, StepsMock } from '@/components/client/guide/clientMocksA';
import { ChatMock, PayMock, FilesMock, HolidayMock } from '@/components/client/guide/clientMocksB';
import { cloud } from '@/lib/cloudContent';
import { tx } from '@/lib/landingContent';

const MOCKS = { dash: DashMock, steps: StepsMock, chat: ChatMock, files: FilesMock, pay: PayMock, holiday: HolidayMock };

// 번호 표시 없이 예시 화면만 보여 준다
export default function CloudMock({ name, lang }) {
  const M = MOCKS[name];
  return (
    <figure className="w-full max-w-[560px] min-w-0 mx-auto">
      <MockPlainContext.Provider value={true}><M /></MockPlainContext.Provider>
      <figcaption className="mt-2 text-[11px] text-landing-muted2 text-center">{tx(cloud.sample, lang)}</figcaption>
    </figure>
  );
}