'use client';

import { PostActions } from '@/components/community-actions';

/** Pont client pour les actions de publication (suppression par l'auteur, masquage par la modération). */
export function CommunityPostActions(props: { postId: string; canDelete: boolean; canHide: boolean }) {
  return <PostActions {...props} />;
}
