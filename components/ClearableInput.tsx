import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { palette } from '../constants/Colors';

interface ClearableInputProps extends TextInputProps {
  /** Called when the ✕ is tapped. Defaults to onChangeText(''). */
  onClear?: () => void;
  /** Style for the wrapping View (use for flex/margins; keep input styling on `style`). */
  containerStyle?: StyleProp<ViewStyle>;
}

// TextInput with a small ✕ inside its right edge, shown only when non-empty.
// The app-wide clear affordance (UR-5): use this for any text field where
// wiping and retyping is common. Not for passwords or composers with their
// own right-edge action.
const ClearableInput = forwardRef<TextInput, ClearableInputProps>(
  ({ onClear, containerStyle, style, ...rest }, ref) => {
    const hasText = !!rest.value && rest.value.length > 0;

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else {
        rest.onChangeText?.('');
      }
    };

    return (
      <View style={[styles.wrap, containerStyle]}>
        <TextInput ref={ref} style={[style, hasText && styles.inputWithClear]} {...rest} />
        {hasText && (
          <Pressable
            style={[styles.clearButton, rest.multiline ? styles.clearTop : styles.clearCentered]}
            onPress={handleClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear text"
          >
            <Ionicons name="close-circle" size={18} color={palette.muted} />
          </Pressable>
        )}
      </View>
    );
  }
);

ClearableInput.displayName = 'ClearableInput';

export default ClearableInput;

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  inputWithClear: {
    paddingRight: 38,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
  },
  clearCentered: {
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  clearTop: {
    top: 12,
  },
});
