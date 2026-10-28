import { OverviewMock, LoginMock, BoardMock, InquiryMock, DetailMock, StepsMock, SchedMock } from '@/components/client/guide/clientMocksA';
import { QuoteMock, ChatMock, FilesMock, HolidayMock, AccountMock } from '@/components/client/guide/clientMocksB';
import { DashMock, CalendarMock, PayMock, DocsMock, NotifMock } from '@/components/client/guide/clientMocksC';

export { OverviewMock };
export const CLIENT_MOCKS = {
  login: LoginMock, dash: DashMock, calendar: CalendarMock, board: BoardMock, inquiry: InquiryMock, detail: DetailMock, steps: StepsMock, sched: SchedMock,
  quote: QuoteMock, chat: ChatMock, pay: PayMock, files: FilesMock, library: DocsMock, notif: NotifMock, holiday: HolidayMock, account: AccountMock,
};