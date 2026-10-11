type ProfileCompletionData = {
  full_name: string | null | undefined;
  location: string | null | undefined;
  occupation: string | null | undefined;
  relationship_goal: string | null | undefined;
  interests: string[] | null | undefined;
  avatar_url: string | null | undefined;
};

export function isProfileComplete(profile: ProfileCompletionData | null | undefined): boolean {
  return Boolean(
    profile?.full_name?.trim() &&
    profile.location?.trim() &&
    profile.occupation?.trim() &&
    profile.relationship_goal?.trim() &&
    profile.interests?.some((interest) => interest.trim()) &&
    profile.avatar_url?.trim(),
  );
}
