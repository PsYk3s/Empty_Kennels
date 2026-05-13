import Dexie, { type Table } from 'dexie';
export class PbDb extends Dexie { leads!: Table<any, string>; syncQueue!: Table<any, number>; catalogues!: Table<any, number>; settings!: Table<any, string>; constructor(){super('pb-app'); this.version(1).stores({leads:'uuid,syncStatus,updatedAt',syncQueue:'++id,leadUuid,retryCount,nextRetryAt',catalogues:'++id,version',settings:'key'});} }
export const db = new PbDb();
