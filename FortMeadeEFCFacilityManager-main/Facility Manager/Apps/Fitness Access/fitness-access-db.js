/* =========================================================
   FITNESS ACCESS OFFLINE SUBMISSION DATABASE
   Eagle Fitness Center
========================================================= */

const FITNESS_DB_NAME = "EFCFitnessAccess";
const FITNESS_DB_VERSION = 1;
const FITNESS_STORE_NAME = "pendingSubmissions";


/* =========================================================
   OPEN DATABASE
========================================================= */

function openFitnessDB() {

  return new Promise((resolve, reject) => {

    const request = indexedDB.open(
      FITNESS_DB_NAME,
      FITNESS_DB_VERSION
    );

    request.onupgradeneeded = function(event) {

      const db = event.target.result;

      if (!db.objectStoreNames.contains(FITNESS_STORE_NAME)) {

        db.createObjectStore(
          FITNESS_STORE_NAME,
          {
            keyPath: "submissionId"
          }
        );

      }

    };


    request.onsuccess = function(event) {
      resolve(event.target.result);
    };


    request.onerror = function(event) {
      reject(event.target.error);
    };

  });

}


/* =========================================================
   SAVE / UPDATE PENDING SUBMISSION
========================================================= */

async function savePendingFitnessSubmission(payload) {

  const db = await openFitnessDB();

  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      FITNESS_STORE_NAME,
      "readwrite"
    );

    const store = transaction.objectStore(
      FITNESS_STORE_NAME
    );


    const record = {
      ...payload,

      savedAt:
        new Date().toISOString(),

      syncAttempts:
        0
    };


    const request =
      store.put(record);


    request.onsuccess = function() {
      resolve(record);
    };


    request.onerror = function(event) {
      reject(event.target.error);
    };


    transaction.oncomplete = function() {
      db.close();
    };

  });

}


/* =========================================================
   GET ALL PENDING SUBMISSIONS
========================================================= */

async function getPendingFitnessSubmissions() {

  const db = await openFitnessDB();

  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      FITNESS_STORE_NAME,
      "readonly"
    );

    const store = transaction.objectStore(
      FITNESS_STORE_NAME
    );

    const request =
      store.getAll();


    request.onsuccess = function() {
      resolve(request.result || []);
    };


    request.onerror = function(event) {
      reject(event.target.error);
    };


    transaction.oncomplete = function() {
      db.close();
    };

  });

}


/* =========================================================
   GET ONE PENDING SUBMISSION
========================================================= */

async function getPendingFitnessSubmission(submissionId) {

  const db = await openFitnessDB();

  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      FITNESS_STORE_NAME,
      "readonly"
    );

    const store = transaction.objectStore(
      FITNESS_STORE_NAME
    );

    const request =
      store.get(submissionId);


    request.onsuccess = function() {
      resolve(request.result || null);
    };


    request.onerror = function(event) {
      reject(event.target.error);
    };


    transaction.oncomplete = function() {
      db.close();
    };

  });

}


/* =========================================================
   DELETE SUBMISSION AFTER SERVER CONFIRMS RECEIPT
========================================================= */

async function deletePendingFitnessSubmission(submissionId) {

  const db = await openFitnessDB();

  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      FITNESS_STORE_NAME,
      "readwrite"
    );

    const store = transaction.objectStore(
      FITNESS_STORE_NAME
    );

    const request =
      store.delete(submissionId);


    request.onsuccess = function() {
      resolve(true);
    };


    request.onerror = function(event) {
      reject(event.target.error);
    };


    transaction.oncomplete = function() {
      db.close();
    };

  });

}


/* =========================================================
   COUNT PENDING SUBMISSIONS
========================================================= */

async function countPendingFitnessSubmissions() {

  const db = await openFitnessDB();

  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      FITNESS_STORE_NAME,
      "readonly"
    );

    const store = transaction.objectStore(
      FITNESS_STORE_NAME
    );

    const request =
      store.count();


    request.onsuccess = function() {
      resolve(request.result || 0);
    };


    request.onerror = function(event) {
      reject(event.target.error);
    };


    transaction.oncomplete = function() {
      db.close();
    };

  });

}


/* =========================================================
   UPDATE SYNC ATTEMPT INFORMATION
========================================================= */

async function markFitnessSyncAttempt(submissionId) {

  const record =
    await getPendingFitnessSubmission(
      submissionId
    );


  if (!record) {
    return;
  }


  record.syncAttempts =
    (record.syncAttempts || 0) + 1;


  record.lastSyncAttempt =
    new Date().toISOString();


  const db = await openFitnessDB();


  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      FITNESS_STORE_NAME,
      "readwrite"
    );

    const store = transaction.objectStore(
      FITNESS_STORE_NAME
    );


    const request =
      store.put(record);


    request.onsuccess = function() {
      resolve(record);
    };


    request.onerror = function(event) {
      reject(event.target.error);
    };


    transaction.oncomplete = function() {
      db.close();
    };

  });

}
