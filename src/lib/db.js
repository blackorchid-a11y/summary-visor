import { openDB } from 'idb';

const DB_NAME = 'mir-summaries-db';
const DB_VERSION = 1;

export const initDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('subjects')) {
                const store = db.createObjectStore('subjects', { keyPath: 'id' });
                store.createIndex('name', 'name');
            }
            if (!db.objectStoreNames.contains('topics')) {
                const store = db.createObjectStore('topics', { keyPath: 'id' });
                store.createIndex('subjectId', 'subjectId');
            }
        },
    });
};

export const getSubjects = async () => {
    const db = await initDB();
    return db.getAll('subjects');
};

export const saveSubject = async (subject) => {
    const db = await initDB();
    return db.put('subjects', subject);
};

export const getTopicsBySubject = async (subjectId) => {
    const db = await initDB();
    return db.getAllFromIndex('topics', 'subjectId', subjectId);
};

export const getTopic = async (id) => {
    const db = await initDB();
    return db.get('topics', id);
};

export const saveTopic = async (topic) => {
    const db = await initDB();
    return db.put('topics', topic);
};

export const deleteTopic = async (id) => {
    const db = await initDB();
    return db.delete('topics', id);
};
