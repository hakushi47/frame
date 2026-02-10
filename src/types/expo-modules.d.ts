declare module 'expo-camera' {
  import * as React from 'react';
  import { ViewProps } from 'react-native';

  export type CameraCapturedPicture = {
    uri: string;
    width: number;
    height: number;
  };

  export type CameraViewProps = ViewProps & {
    facing?: 'front' | 'back';
  };

  export class CameraView extends React.Component<CameraViewProps> {
    takePictureAsync(options?: { quality?: number }): Promise<CameraCapturedPicture>;
  }

  export function useCameraPermissions(): [
    { granted: boolean } | null,
    () => Promise<{ granted: boolean }>
  ];
}

declare module 'expo-image-picker' {
  export type ImagePickerAsset = {
    uri: string;
  };

  export type ImagePickerResult =
    | {
        canceled: true;
        assets: null;
      }
    | {
        canceled: false;
        assets: ImagePickerAsset[];
      };

  export function requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;

  export function launchImageLibraryAsync(options?: {
    mediaTypes?: string[];
    quality?: number;
    allowsEditing?: boolean;
  }): Promise<ImagePickerResult>;
}
