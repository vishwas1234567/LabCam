/* eslint-disable react/jsx-indent */
import React from 'react';
import PropTypes from 'prop-types';
import {
  StatusBar,
  SafeAreaView,
  Image,
  Text,
  View,
  Alert,
  TouchableOpacity,
  CameraRoll,
  NetInfo,
  AppState,
  Platform,
  BackHandler,
  Dimensions,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import { connect } from 'react-redux';
import { NavigationActions } from 'react-navigation';
import Icon from 'react-native-vector-icons/FontAwesome';
import MIcon from 'react-native-vector-icons/MaterialIcons';
import IIcon from 'react-native-vector-icons/Ionicons';
import AccountsActions from '../../redux/AccountsRedux';
import UploadActions from '../../redux/UploadRedux';
import LibraryActions from '../../redux/LibraryRedux';
import {
  retrievePhotos,
  storePhotos,
  retrieveOcrTextFile,
  storeOcrTextFile,
  storeCurrentState,
  retrieveUploadError,
  removeItemValue,
} from '../../storage/DbHelper';
import { startService, stopService, createFile, hasFlash } from '../../tasks/OcrHelper';
import CamColors from '../../common/CamColors';
import styles from './styles';
import OcrModal from '../../components/CameraComponents/OcrModal';
import KeeperOptionModal from '../../components/CameraComponents/KeeperOptionModal';
import BigPicModal from '../../components/CameraComponents/BigPicModal';

const flashModeOrder = {
  off: 'on',
  on: 'auto',
  auto: 'off',
};

const wbOrder = {
  auto: 'sunny',
  sunny: 'cloudy',
  cloudy: 'shadow',
  shadow: 'fluorescent',
  fluorescent: 'incandescent',
  incandescent: 'auto',
};

const androidOptions = {
  fixOrientation: true,
  skipProcessing: true,
};

const iosOptions = {
  forceUpOrientation: true,
};

let alertPresent = false;

class CameraScreen extends React.Component {
  state = {
    hasFlash: false,
    flash: 'off',
    autoFocus: 'on',
    depth: 0,
    type: 'back',
    whiteBalance: 'auto',
    ratio: '4:3',
    keeperOptionVisible: false,
    bigPicVisible: false,
    countClick: 0,
    countTakePhoto: 0,
    isCameraReady: true,
    lastPhotoUri: '',
    netInfo: '',
    appState: AppState.currentState,
    ocrEnable: false,
    ocrScanText: '',
    dateTime: 0,
    isLandscape: false,
  };

  componentWillMount() {
    if (Platform.OS === 'android') {
      hasFlash().then(flash =>
        this.setState({
          hasFlash: flash,
        }));
    } else {
      this.setState({
        hasFlash: true,
      });
    }
  }

  componentDidMount() {
    NetInfo.getConnectionInfo().then((connectionInfo) => {
      this.setState({
        netInfo: connectionInfo.type,
      });
    });
    NetInfo.addEventListener('connectionChange', this._handleConnectionChange);
    AppState.addEventListener('change', this._handleAppStateChange);
    BackHandler.addEventListener('hardwareBackPress', this.handleBackPress);
  }

  componentWillUnmount() {
    NetInfo.removeEventListener('connectionChange', this._handleConnectionChange);
    AppState.removeEventListener('change', this._handleAppStateChange);
    BackHandler.removeEventListener('hardwareBackPress', this.handleBackPress);
  }

  onLayout = (e) => {
    const { width, height } = Dimensions.get('window');
    this.setState({
      isLandscape: width > height,
    });
  };

  onSelectLibrary = () => {
    this.setState({
      keeperOptionVisible: false,
    });

    this.goBack();
  };

  getRatios = async () => {
    const ratios = await this.camera.getSupportedRatiosAsync();
    Alert.alert('Ratios', ratios.join());
  };

  setFocusDepth = (depth) => {
    this.setState({
      depth,
    });
  };

  handleBackPress = () => {
    const { keeperOptionVisible, bigPicVisible, ocrEnable } = this.state;
    if (keeperOptionVisible) {
      this.setState({
        keeperOptionVisible: false,
      });
    }

    if (bigPicVisible) {
      this.setState({
        bigPicVisible: false,
      });
    }

    if (ocrEnable) {
      this.setState({
        ocrEnable: false,
      });
    }
    return true;
  };

  _handleConnectionChange = (connectionInfo) => {
    const { batchUpload, netOption } = this.props;

    retrievePhotos().then((photos) => {
      if (photos && photos.length > 0) {
        switch (netOption) {
          case 'Wifi only':
            if (connectionInfo.type === 'wifi') {
              console.log('Wifi only');
              batchUpload(photos);
            }
            break;
          case 'Cellular':
            if (connectionInfo.type === 'wifi' || connectionInfo.type === 'cellular') {
              batchUpload(photos);
            }
            break;
          default:
            break;
        }
      }
      this.setState({
        netInfo: connectionInfo.type,
      });
    });
  };

  _handleAppStateChange = (nextAppState) => {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!');
      storeCurrentState('active');

      retrieveUploadError().then((uploadError) => {
        if (uploadError && uploadError.length > 0) {
          this.showFolderNotExistAlert();
          removeItemValue('uploadError');
        }
      });

      if (Platform.OS === 'android') {
        stopService();
        this.props.pingServer();
      } else if (Platform.OS === 'ios') {
        this.props.syncUploadProgress(); // ios background db write bug
      }
      NetInfo.getConnectionInfo().then((connectionInfo) => {
        this.setState({
          netInfo: connectionInfo.type,
        });
      });
    } else if (this.state.appState.match(/active/) && nextAppState === 'background') {
      console.log('App has come to the background!');
      storeCurrentState('background');
      if (Platform.OS === 'android') {
        startService();
      }
    }
    this.setState({ appState: nextAppState });
  };

  toggleKeeperOption = () => {
    this.setState({
      keeperOptionVisible: !this.state.keeperOptionVisible,
      ocrEnable: false,
    });
    this.props.pingServer();
  };

  closeKeeperOption = () => {
    this.setState({
      keeperOptionVisible: false,
    });
  };

  toggleFacing = () => {
    this.setState({
      type: this.state.type === 'back' ? 'front' : 'back',
    });
  };

  toggleFlash = () => {
    this.setState({
      flash: flashModeOrder[this.state.flash],
    });
  };

  toggleOcr = () => {
    this.setState({
      keeperOptionVisible: false,
    });

    this.setState({
      ocrEnable:
        this.state.ocrEnable === false
          ? (d) => {
            if (Date.now() - this.state.dateTime > 3000) {
              const ocrScanText = d.textBlocks
                .sort((a, b) => a.bounds.origin.y - b.bounds.origin.y)
                .map(e => e.value)
                .reduce((prev, cur) => `${prev}\n${cur}`, '');
              this.setState({
                ocrScanText,
              });
              this.setState({
                dateTime: Date.now(),
              });
            }
          }
          : false,
    });

    this.setState({
      ocrScanText: '',
    });
  };

  toggleWB = () => {
    this.setState({
      whiteBalance: wbOrder[this.state.whiteBalance],
    });
  };

  toggleFocus = () => {
    this.setState({
      autoFocus: this.state.autoFocus === 'on' ? 'off' : 'on',
    });
  };

  toggleBigPic = () => {
    if (this.state.lastPhotoUri) {
      this.setState({
        bigPicVisible: !this.state.bigPicVisible,
      });
    }
  };

  takePicture = async () => {
    this.setState({
      countClick: this.state.countClick + 1,
      isCameraReady: false,
      keeperOptionVisible: false,
    });

    const options = Platform.OS === 'android' ? androidOptions : iosOptions;
    if (this.camera) {
      this.camera.takePictureAsync(options).then((photo) => {
        console.log(photo);
        this.setState({
          isCameraReady: true,
          countTakePhoto: this.state.countTakePhoto + 1,
        });
        this.saveToCameraRoll(photo);
      });
    }
  };

  uploadToKeeper = (photoDTO) => {
    const { uploadFile, netOption } = this.props;
    const { netInfo } = this.state;
    console.log(netInfo);
    console.log(netOption);
    switch (netOption) {
      case 'Wifi only':
        if (netInfo === 'wifi') {
          console.log('Wifi only');
          uploadFile(photoDTO);
        }
        break;
      case 'Cellular':
        if (netInfo === 'wifi' || netInfo === 'cellular') {
          uploadFile(photoDTO);
        }
        break;
      default:
        break;
    }
  };

  saveToCameraRoll = (image) => {
    CameraRoll.saveToCameraRoll(image.uri).then((contentUri) => {
      this.setState({
        lastPhotoUri: contentUri,
      });
      const fileName = image.uri.substring(image.uri.lastIndexOf('/') + 1);
      retrievePhotos().then((photos) => {
        photos.push({
          fileName,
          contentUri,
        });

        storePhotos(photos).then(() => {
          if (this.state.netInfo !== 'none') {
            setTimeout(() => {
              this.uploadToKeeper({
                fileName,
                contentUri,
              });
            }, 2000);
          }
        });
      });
      this.uploadOcr(fileName);
    });
  };

  uploadOcr = async (fileName) => {
    const { ocrScanText, ocrEnable } = this.state;
    if (!ocrEnable || !ocrScanText) return;

    const mdFileName = fileName.replace('jpg', 'md');
    const contentUri = await createFile(ocrScanText, mdFileName);
    const ocrTextFileList = await retrieveOcrTextFile();
    ocrTextFileList.push({
      fileName: mdFileName,
      contentUri,
      text: ocrScanText,
    });
    storeOcrTextFile(ocrTextFileList);
    if (this.state.netInfo !== 'none') {
      this.uploadToKeeper({
        fileName: mdFileName,
        contentUri,
      });
    }
  };

  goBack = () => {
    const { nav } = this.props;
    if (nav.index === 0) {
      this.props.navigation.dispatch(NavigationActions.navigate({
        routeName: 'Library',
      }));
    } else {
      this.props.navigation.goBack();
    }
  };

  logout = () => {
    retrievePhotos().then((photos) => {
      if (photos.length > 0) {
        this.logoutAlert('Unuploaded files detected, these files will not be uploaded by clicking the "Logout" button.');
      } else {
        retrieveOcrTextFile().then((files) => {
          if (files.length > 0) {
            this.logoutAlert('Unuploaded files detected, these files will not be uploaded by clicking the "Logout" button.');
          } else {
            this.logoutAlert('Are you sure to logout?');
          }
        });
      }
    });
  };

  logoutAlert = (message) => {
    Alert.alert('Logout', message, [
      { text: 'Cancel', onPress: () => console.log('Cancel Pressed'), style: 'cancel' },
      {
        text: 'Logout',
        onPress: () => {
          this.cleanAndLogout();
        },
      },
    ]);
  };

  cleanAndLogout = () => {
    const {
      setAuthenticateResult,
      setDestinationLibrary,
      setPaths,
      setParentDir,
      setLibraries,
    } = this.props;
    setAuthenticateResult(null);
    setDestinationLibrary(null);
    setPaths([]);
    setParentDir(null);
    setLibraries([]);
    storePhotos([]);
    storeOcrTextFile([]);
    storeCurrentState('none');
    this.props.navigation.dispatch(NavigationActions.reset({
      index: 0,
      actions: [
        NavigationActions.navigate({
          routeName: 'Login',
        }),
      ],
    }));
  };

  destination = () => {
    const { paths, destinationLibrary } = this.props;
    if (paths && paths.length) {
      return paths[paths.length - 1].name;
    }
    return destinationLibrary ? destinationLibrary.name : null;
  };

  isShowWarning = () => {
    const { netInfo, keeperOptionVisible, bigPicVisible } = this.state;
    const { netOption } = this.props;
    if (Platform.OS === 'ios' && !keeperOptionVisible && !bigPicVisible) {
      switch (netOption) {
        case 'Wifi only':
          if (netInfo && netInfo !== 'wifi' && netInfo !== 'unknown') {
            // 'unknown at init'
            return true;
          }
          break;
        case 'Cellular':
          if (netInfo !== 'wifi' && netInfo !== 'cellular') {
            return true;
          }
          break;
        default:
          break;
      }
    }
    return false;
  };

  showFolderNotExistAlert = () => {
    alertPresent = true;

    Alert.alert(
      'Upload not successful',
      "Couldn't find selected folder, please choose another one",
      [
        {
          text: 'change',
          onPress: () => {
            alertPresent = false;
            this.props.clearUploadError();
            this.props.navigation.dispatch(NavigationActions.reset({
              index: 0,
              actions: [
                NavigationActions.navigate({
                  routeName: 'Library',
                }),
              ],
            }));
          },
        },
      ],
      { cancelable: false },
    );
  };

  renderTopMenu = () => {
    const OCRStyle =
      this.state.ocrEnable === false
        ? [styles.photoHelper, { color: 'grey' }]
        : [styles.photoHelper, { color: CamColors.green2 }];

    const menuBarStyle =
      this.state.isLandscape
        ? styles.menuBarVertical
        : styles.menuBar;

    const cameraOptionStyle =
      this.state.isLandscape
        ? [styles.cameraOption, { flexDirection: 'column' }]
        : [styles.cameraOption, { flexDirection: 'row' }];

    const topMenuIconStyle =
      this.state.isLandscape
        ? [{ marginVertical: 16 }]
        : [{ marginHorizontal: 16 }];

    return (
      <View style={menuBarStyle}>
        <TouchableOpacity style={styles.keeperIcon} onPress={this.toggleKeeperOption}>
          <MIcon name="menu" color="white" size={24} style={topMenuIconStyle} />
        </TouchableOpacity>

        <View style={cameraOptionStyle}>
          {
            <TouchableOpacity onPress={this.toggleOcr}>
              <Text style={OCRStyle}>OCR</Text>
            </TouchableOpacity>
          }
          {this.state.hasFlash && (
            <TouchableOpacity onPress={this.toggleFlash}>
              <MIcon
                name={`flash-${this.state.flash}`}
                color="white"
                size={24}
                style={topMenuIconStyle}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  renderCameraButtons = () => {
    const { width, height } = Dimensions.get('window');
    const standardRatio = ((height > 4*width/3) && !this.state.isLandscape)
        || ((width > 4*height/3) && this.state.isLandscape);

    const buttonsContainerStyle = !this.state.isLandscape
      ? standardRatio ? [styles.cameraButton, { flex: 1 }] : [styles.cameraButton, { height: 80 }]
      : standardRatio ? [styles.cameraButtonVertical, { flex: 1 }] : [styles.cameraButtonVertical, { width: 80 }];
    return (
      <View
        style={buttonsContainerStyle}
      >
        <TouchableOpacity
          style={[{ alignSelf: 'center' }]}
          onPress={this.toggleBigPic}
        >
          {this.state.lastPhotoUri === '' ? (
            <View
              style={[styles.preview, { backgroundColor: CamColors.colorWithAlpha('white', 0.5) }]}
            />
          ) : (
            <Image style={styles.preview} source={{ uri: this.state.lastPhotoUri }} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[{ alignSelf: 'center' }]}
          onPress={this.takePicture}
          disabled={!this.state.isCameraReady}
        >
          <Icon name="camera" color="white" size={24} style={styles.cameraIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[{ alignSelf: 'center' }]}
          onPress={this.toggleFacing}
        >
          <IIcon name="ios-reverse-camera" color="white" size={38} style={styles.flipIcon} />
        </TouchableOpacity>
      </View>);
  }

  renderCamera = () => {
    const { width, height } = Dimensions.get('window');

    const cameraHeight = height - 120 - StatusBar.currentHeight;
    const cameraWidth = width - 140;

    const standardRatio = (cameraHeight > 4*width/3 && width < height)
        || (cameraWidth > 4*height/3 && height > width);

    const standardCameraStyle = !this.state.isLandscape
      ? [{ width: '100%', height: 4*width/3, alignSelf: 'center' }]
      : [{ width: 4*height/3, height: '100%', alignSelf: 'center' }];

    const cameraStyle = !this.state.isLandscape
      ? [{ width: 3*cameraHeight/4, height: cameraHeight, alignSelf: 'center' }]
      : [{ width: cameraWidth, height:  3*cameraWidth/4, alignSelf: 'center' }];

    return (
        <RNCamera
          ref={(ref) => {
            this.camera = ref;
          }}
          style={standardRatio ? standardCameraStyle : cameraStyle}
          type={this.state.type}
          flashMode={this.state.flash}
          autoFocus={this.state.autoFocus}
          whiteBalance={this.state.whiteBalance}
          ratio={this.state.ratio}
          focusDepth={this.state.depth}
          permissionDialogTitle="Permission to use camera"
          permissionDialogMessage="We need your permission to use your camera phone"
          onTextRecognized={this.state.ocrEnable}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={this.closeKeeperOption}
          />
        </RNCamera>
    );
  }

  render() {
    if (!alertPresent) {
      if (this.props.loginState && this.props.loginState === 'auth failed') {
        alertPresent = true;
        Alert.alert('Authentication', 'Authentication Expired, please login again.', [
          {
            text: 'OK',
            onPress: () => {
              this.props.setLoginState('');
              this.cleanAndLogout();
              alertPresent = false;
            },
          },
        ]);
      }
      if (this.props.uploadError && this.props.uploadError.length > 0) {
        this.showFolderNotExistAlert();
      }
    }

    const containerStyle = this.state.isLandscape
      ? [styles.container, { flexDirection: 'row' }]
      : [styles.container, { paddingTop: StatusBar.currentHeight }];

    return (
      <SafeAreaView style={containerStyle} onLayout={this.onLayout}>
        <StatusBar translucent barStyle="light-content" hidden={this.state.isLandscape} />
        {this.renderTopMenu()}
        {!this.state.ocrEnable &&
          this.state.keeperOptionVisible && (
            <KeeperOptionModal
              libraries={this.props.libraries}
              onSelectLibrary={this.onSelectLibrary}
              destination={this.destination()}
              logout={this.logout}
              isLandscape={this.state.isLandscape}
            />
          )}
        {this.state.ocrEnable && (
          <OcrModal ocrEnable={this.state.ocrEnable} ocrScanText={this.state.ocrScanText} isLandscape={this.state.isLandscape} />
        )}
        {this.state.bigPicVisible && (
          <BigPicModal toggleBigPic={this.toggleBigPic} uri={this.state.lastPhotoUri} />
        )}
        {this.renderCamera()}
        {this.renderCameraButtons()}
      </SafeAreaView>
    );
  }
}

CameraScreen.propTypes = {
  paths: PropTypes.array.isRequired,
  libraries: PropTypes.array.isRequired,
  batchUpload: PropTypes.func.isRequired,
  syncUploadProgress: PropTypes.func.isRequired,
  uploadFile: PropTypes.func.isRequired,
  setAuthenticateResult: PropTypes.func.isRequired,
  setDestinationLibrary: PropTypes.func.isRequired,
  setLibraries: PropTypes.func.isRequired,
  setPaths: PropTypes.func.isRequired,
  setParentDir: PropTypes.func.isRequired,
  netOption: PropTypes.string.isRequired,
  navigation: PropTypes.object.isRequired,
  destinationLibrary: PropTypes.object,
  nav: PropTypes.object.isRequired,
  uploadError: PropTypes.string.isRequired,
  clearUploadError: PropTypes.func.isRequired,
  loginState: PropTypes.string.isRequired,
  setLoginState: PropTypes.func.isRequired,
  pingServer: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  server: state.accounts.server,
  libraries: state.library.libraries,
  destinationLibrary: state.library.destinationLibrary,
  paths: state.library.paths,
  netOption: state.upload.netOption,
  uploadError: state.upload.error,
  loginState: state.accounts.loginState,
  nav: state.nav,
});

const mapDispatchToProps = dispatch => ({
  uploadFile: photo => dispatch(UploadActions.uploadFile(photo)),
  batchUpload: photos => dispatch(UploadActions.batchUpload(photos)),
  syncUploadProgress: () => dispatch(UploadActions.syncUploadProgress()),
  fetchLibraries: () => dispatch(LibraryActions.fetchLibraries()),
  setDestinationLibrary: destinationLibrary =>
    dispatch(LibraryActions.setDestinationLibrary(destinationLibrary)),
  setLibraries: libraries => dispatch(LibraryActions.setLibraries(libraries)),
  setPaths: paths => dispatch(LibraryActions.setPaths(paths)),
  setParentDir: parentDir => dispatch(LibraryActions.setParentDir(parentDir)),
  setAuthenticateResult: result => dispatch(AccountsActions.setAuthenticateResult(result)),
  setNetOption: netOption => dispatch(UploadActions.setNetOption(netOption)),
  clearUploadError: () => dispatch(UploadActions.uploadError('')),
  setLoginState: state => dispatch(AccountsActions.setLoginState(state)),
  pingServer: () => dispatch(AccountsActions.pingServer()),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(CameraScreen);
