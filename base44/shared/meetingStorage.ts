export async function saveMeetingFile(svc, text, name, type = 'text/plain') {
  const result = await svc.integrations.Core.UploadPrivateFile({ file: new File([text], name, { type }) });
  if (!result.file_uri) throw new Error('비공개 파일 저장에 실패했습니다');
  return result.file_uri;
}
export async function signMeetingFile(svc, uri) {
  return (await svc.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 3600 })).signed_url;
}
export async function readMeetingFile(svc, uri) {
  const response = await fetch(await signMeetingFile(svc, uri));
  if (!response.ok) throw new Error('저장된 파일을 읽을 수 없습니다');
  return await response.text();
}
export function meetingSource(log) {
  return JSON.stringify([log.notes || '', log.decisions || '', log.next_steps || '', log.transcript_uri || log.transcript || '']);
}