import { transactionTypeEnum } from './billing';
import { sessionStatusEnum, weekDayEnum } from './scheduling';

export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type WeekDay = (typeof weekDayEnum.enumValues)[number];

export const SESSION_STATUS_OPTIONS = sessionStatusEnum.enumValues;
export const TRANSACTION_TYPE_OPTIONS = transactionTypeEnum.enumValues;
export const WEEKDAY_OPTIONS = weekDayEnum.enumValues;

export const DEFAULT_SESSION_STATUS: SessionStatus = 'Scheduled';
export const CANCELED_SESSION_STATUS: SessionStatus = 'Canceled';
export const RESCHEDULED_SESSION_STATUS: SessionStatus = 'Rescheduled';

export const FREE_SLOT_STATUSES = [CANCELED_SESSION_STATUS, RESCHEDULED_SESSION_STATUS] as const;
export type FreeSlotStatus = (typeof FREE_SLOT_STATUSES)[number];
