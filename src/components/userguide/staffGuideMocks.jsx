import { MenuMock, OwnerMock, CreateMock, ConfirmMock, CompleteMock, QcMock, DelayMock } from '@/components/userguide/staffMocksA';
import { CompareMock, EsignMock, LandedMock, AssistantMock, InboxMock, FactoryMock, QualityMock, ArriveMock } from '@/components/userguide/staffMocksC';
import { PayRequestMock, PayeeMock, PortalMock, ClientTeamMock, FileReviewStaffMock, QuoteAcceptMock, InquiryFormStaffMock, ReorderStaffMock, ClaimTrackStaffMock } from '@/components/userguide/staffMocksD';
import { IntakeMock, FactoryQuoteMock, QuoteImportMock, MarginRuleMock, ApprovalMock, QuoteDigestMock } from '@/components/userguide/staffMocksE';
import { MemberMock, MyWorkMock, BoardMock, OpsMock, AlertMock, HolidayMock, ScheduleMock, ClientMock } from '@/components/userguide/staffMocksB';

export const STAFF_MOCKS = {
  intake: IntakeMock, factoryquote: FactoryQuoteMock, quoteimport: QuoteImportMock, margin: MarginRuleMock, approval: ApprovalMock, quotedigest: QuoteDigestMock,
  compare: CompareMock, esign: EsignMock, landed: LandedMock, assistant: AssistantMock, inbox: InboxMock, payreq: PayRequestMock, payee: PayeeMock, portal: PortalMock, clientteam: ClientTeamMock, filereview: FileReviewStaffMock, quoteaccept: QuoteAcceptMock, inquiryform: InquiryFormStaffMock, reorder: ReorderStaffMock, claimtrack: ClaimTrackStaffMock, factory: FactoryMock, quality: QualityMock, arrive: ArriveMock,
  menu: MenuMock, owner: OwnerMock, create: CreateMock, confirm: ConfirmMock, complete: CompleteMock, qc: QcMock, delay: DelayMock,
  member: MemberMock, mywork: MyWorkMock, board: BoardMock, ops: OpsMock, alert: AlertMock, holiday: HolidayMock, schedule: ScheduleMock, client: ClientMock,
};