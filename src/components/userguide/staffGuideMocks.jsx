import { MenuMock, OwnerMock, CreateMock, ConfirmMock, CompleteMock, QcMock, DelayMock } from '@/components/userguide/staffMocksA';
import { CompareMock, EsignMock, LandedMock, AssistantMock, InboxMock, FactoryMock, QualityMock, ArriveMock } from '@/components/userguide/staffMocksC';
import { PayRequestMock, PayeeMock, PortalMock, ClientTeamMock, FileReviewStaffMock, QuoteAcceptMock } from '@/components/userguide/staffMocksD';
import { MemberMock, MyWorkMock, BoardMock, OpsMock, AlertMock, HolidayMock, ScheduleMock, ClientMock } from '@/components/userguide/staffMocksB';

export const STAFF_MOCKS = {
  compare: CompareMock, esign: EsignMock, landed: LandedMock, assistant: AssistantMock, inbox: InboxMock, payreq: PayRequestMock, payee: PayeeMock, portal: PortalMock, clientteam: ClientTeamMock, filereview: FileReviewStaffMock, quoteaccept: QuoteAcceptMock, factory: FactoryMock, quality: QualityMock, arrive: ArriveMock,
  menu: MenuMock, owner: OwnerMock, create: CreateMock, confirm: ConfirmMock, complete: CompleteMock, qc: QcMock, delay: DelayMock,
  member: MemberMock, mywork: MyWorkMock, board: BoardMock, ops: OpsMock, alert: AlertMock, holiday: HolidayMock, schedule: ScheduleMock, client: ClientMock,
};