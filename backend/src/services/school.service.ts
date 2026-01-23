import type { DatabaseContext } from '../db';

export const createSchoolService = ({ db }: { db: DatabaseContext }) => {
  const getProfile = async () => {
    const profiles = await db.query<any>('SELECT * FROM school_profile WHERE id = 1');
    return (
      profiles[0] ?? {
        name: '',
        tagline: null,
        logo_url: null,
        banner_url: null,
        theme_color: 'sekolah'
      }
    );
  };

  return { getProfile };
};
