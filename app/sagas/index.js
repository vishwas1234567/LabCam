import { takeLatest, takeEvery, all } from 'redux-saga/effects';

/* ------------- Types ------------- */

import { StartupTypes } from '../redux/StartupRedux';
import { AccountsTypes } from '../redux/AccountsRedux';
import { UploadTypes } from '../redux/UploadRedux';
import { LibraryTypes } from '../redux/LibraryRedux';

/* ------------- Sagas ------------- */

import { startup } from './StartupSagas';
import { authenticateAccount } from './AccountsSagas';
import { uploadFile, batchUpload } from './UploadSagas';
import { fetchLibrariesSaga, fetchDirectoriesSaga, selectDirectoriesSaga } from './LibrarySagas';

/* ------------- Connect Types To Sagas ------------- */

export default function* rootSaga() {
  yield all([
    takeLatest(StartupTypes.STARTUP, startup),
    takeLatest(AccountsTypes.AUTHENTICATE_ACCOUNT, authenticateAccount),
    takeEvery(UploadTypes.UPLOAD_FILE, uploadFile),
    takeLatest(UploadTypes.BATCH_UPLOAD, batchUpload),
    takeEvery(LibraryTypes.FETCH_LIBRARIES, fetchLibrariesSaga),
    takeLatest(LibraryTypes.FETCH_DIRECTORIES, fetchDirectoriesSaga),
    takeLatest(LibraryTypes.SELECT_DIRECTORIES, selectDirectoriesSaga),
  ]);
}
