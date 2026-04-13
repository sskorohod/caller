'use client';
import { useParams } from 'next/navigation';
import PromptEditor from '../../_components/PromptEditor';

export default function EditPromptPackPage() {
  const { id } = useParams<{ id: string }>();
  return <PromptEditor packId={id} />;
}
