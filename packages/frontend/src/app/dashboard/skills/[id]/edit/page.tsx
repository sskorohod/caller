'use client';
import { useParams } from 'next/navigation';
import SkillEditor from '../../_components/SkillEditor';

export default function EditSkillPage() {
  const params = useParams();
  const id = params.id as string;

  return <SkillEditor skillId={id} />;
}
