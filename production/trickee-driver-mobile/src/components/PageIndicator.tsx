import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Colors} from '../constants/Colors';

interface PageIndicatorProps {
  count: number;
  activeIndex: number;
}

const PageIndicator: React.FC<PageIndicatorProps> = ({count, activeIndex}) => {
  return (
    <View style={styles.container}>
      {Array.from({length: count}).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === activeIndex ? styles.activeDot : styles.inactiveDot,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 20,
    backgroundColor: Colors.trickeeYellow,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});

export default PageIndicator;
