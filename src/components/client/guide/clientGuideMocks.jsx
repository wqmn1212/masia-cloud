import { OverviewMock, LoginMock, BoardMock, InquiryMock, DetailMock, StepsMock, SchedMock } from '@/components/client/guide/clientMocksA';
import { QuoteMock, ChatMock, FilesMock, HolidayMock, AccountMock } from '@/components/client/guide/clientMocksB';
import { DashMock, CalendarMock, PayMock, DocsMock, NotifMock } from '@/components/client/guide/clientMocksC';
import { ReviewMock, TeamMock, ApprovalMock } from '@/components/client/guide/clientMocksD';
import { CostsMock, ClaimMock } from '@/components/client/guide/clientMocksE';

export { OverviewMock };
export const CLIENT_MOCKS = {
  login: LoginMock, dash: DashMock, calendar: CalendarMock, board: BoardMock, inquiry: InquiryMock, detail: DetailMock, steps: StepsMock, sched: SchedMock,
  quote: QuoteMock, chat: ChatMock, pay: PayMock, files: FilesMock, review: ReviewMock, library: DocsMock, costs: CostsMock, claim: ClaimMock, team: TeamMock, approval: ApprovalMock, notif: NotifMock, holiday: HolidayMock, account: AccountMock,
};