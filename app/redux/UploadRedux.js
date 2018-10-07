import { createReducer, createActions } from 'reduxsauce';
import Immutable from 'seamless-immutable';

const { Types, Creators } = createActions({
  uploadFile: ['photo'],
  batchUpload: ['photos'],
  syncUploadProgress: null,
  setNetOption: ['netOption'],
  setOcrTextOnPause: ['ocrTextOnPause'],
  uploadError: ['error'],
});

export const UploadTypes = Types;
export default Creators;

export const INITIAL_STATE = Immutable({
  photos: [],
  netOption: 'Wifi only',
  ocrTextOnPause: '',
  error: '',
});

/* ------------- Reducers ------------- */
export const setNetOption = (state = INITIAL_STATE, action) =>
  state.merge({
    netOption: action.netOption,
  });

export const setOcrTextOnPause = (state = INITIAL_STATE, action) =>
  state.merge({
    ocrTextOnPause: action.ocrTextOnPause,
  });

export const uploadError = (state = INITIAL_STATE, action) =>
  state.merge({
    error: action.error,
  });

/* ------------- Hookup Reducers To Types ------------- */
export const reducer = createReducer(INITIAL_STATE, {
  [Types.SET_NET_OPTION]: setNetOption,
  [Types.SET_OCR_TEXT_ON_PAUSE]: setOcrTextOnPause,
  [Types.UPLOAD_ERROR]: uploadError,
});
