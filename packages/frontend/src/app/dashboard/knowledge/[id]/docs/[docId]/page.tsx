'use client';
import { useParams } from 'next/navigation';
import DocEditor from '../../../_components/DocEditor';

export default function EditDocumentPage() {
  const { id: kbId, docId } = useParams<{ id: string; docId: string }>();
  return <DocEditor kbId={kbId} docId={docId} />;
}
