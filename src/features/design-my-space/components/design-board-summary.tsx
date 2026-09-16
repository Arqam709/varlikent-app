import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, FontSizes, LetterSpacing, Radius, Spacing } from '@/constants/theme';
import {
  DESIGN_LIGHTING,
  DESIGN_ROOMS,
  DESIGN_STYLES,
  designOptionLabelKey,
} from '@/features/design-my-space/design-options';
import type { DesignBoard } from '@/features/design-my-space/design-board';
import { useLanguage } from '@/features/localization/language-context';
import { useDirection } from '@/features/localization/use-direction';
import type { ThemePalette } from '@/features/theme/themes';
import { useThemedStyles } from '@/features/theme/use-themed-styles';

/**
 * THE BOARD, READ BACK.
 *
 * Six labelled rows in the order they were chosen, with the actual swatches
 * and textures — this is the artefact the whole flow exists to produce, and
 * the thing the user sends to a designer.
 *
 * Room, style and lighting are translated from their stable ids. Wall, floor
 * and material names are the SNAPSHOT text stored on the board, so a board
 * always reads back as what was chosen even after an owner changes the
 * palette.
 */

export default function DesignBoardSummary({ board }: { board: DesignBoard }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const { row, textAlign } = useDirection();

  return (
    <View style={styles.board}>
      <SummaryRow label={t('designMySpace.fields.room')} value={t(designOptionLabelKey(DESIGN_ROOMS, board.room))} />
      <SummaryRow label={t('designMySpace.fields.style')} value={t(designOptionLabelKey(DESIGN_STYLES, board.style))} />

      <SummaryRow label={t('designMySpace.fields.wall')} value={board.wall.label} color={board.wall.color} />
      <SummaryRow label={t('designMySpace.fields.floor')} value={board.floor.label} color={board.floor.color} />

      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { textAlign }]}>{t('designMySpace.fields.materials')}</Text>

        {board.materials.length === 0 ? (
          <Text style={[styles.empty, { textAlign }]}>{t('designMySpace.noMaterials')}</Text>
        ) : (
          <View style={styles.materials}>
            {board.materials.map((material) => (
              <View key={`${material.name}-${material.color}`} style={[styles.material, { flexDirection: row }]}>
                <View style={[styles.swatch, { backgroundColor: material.color }]}>
                  {material.image ? (
                    <Image
                      source={{ uri: material.image }}
                      style={styles.swatchImage}
                      contentFit="cover"
                      accessibilityLabel={t('designMySpace.materialImageA11y', { name: material.name })}
                    />
                  ) : null}
                </View>
                <Text style={[styles.value, { textAlign }]}>{material.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <SummaryRow
        label={t('designMySpace.fields.lighting')}
        value={t(designOptionLabelKey(DESIGN_LIGHTING, board.lighting))}
      />
    </View>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const styles = useThemedStyles(makeStyles);
  const { row, textAlign } = useDirection();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { textAlign }]}>{label}</Text>
      <View style={[styles.valueRow, { flexDirection: row }]}>
        {color ? <View style={[styles.swatch, { backgroundColor: color }]} /> : null}
        <Text style={[styles.value, { textAlign }]}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: ThemePalette) => StyleSheet.create({
  board: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
  },
  field: { gap: Spacing.xs },
  fieldLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSizes.overline,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.textMuted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  value: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSizes.md,
    color: theme.text,
  },
  empty: {
    fontFamily: FontFamily.body,
    fontSize: FontSizes.sm,
    color: theme.textMuted,
  },

  materials: { gap: Spacing.sm },
  material: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  swatchImage: { width: '100%', height: '100%' },
});
