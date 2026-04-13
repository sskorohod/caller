'use client';
import { useParams } from 'next/navigation';
import DocEditor from '../../../_components/DocEditor';

export default function NewDocumentPage() {
  const { id: kbId } = useParams<{ id: string }>();
  return <DocEditor kbId={kbId} />;
}
