import { users } from './schema';

type UserRecord = typeof users.$inferSelect;

export type EmbeddedUser = {
  first_name: UserRecord['firstName'];
  last_name: UserRecord['lastName'];
  email: UserRecord['email'];
  phone: UserRecord['phone'];
};
