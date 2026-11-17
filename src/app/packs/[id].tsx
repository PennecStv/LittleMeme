import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { MemeView } from '../../components/MemeView';
import { colors, fonts, radius, space, themed } from '../../components/theme';
import { Body, Button, Card, Label, Screen, Title } from '../../components/ui';
import { MemeTemplate, TextZone } from '../../shared/types';
import {
  addTemplate,
  deletePack,
  deleteTemplate,
  getPack,
  imageFile,
  packsSignal,
  renamePack,
  updateTemplate,
  ZONE_PRESETS,
} from '../../storage/packs';

const SAMPLE = ['Quand le Wifi marche enfin', 'Et que c’est ton tour'];

type Draft =
  | { mode: 'new'; uri: string; width: number; height: number; mimeType?: string; name: string; zones: TextZone[] }
  | { mode: 'edit'; template: MemeTemplate; name: string; zones: TextZone[] };

export default function PackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useSyncExternalStore(packsSignal.subscribe, packsSignal.getVersion);
  const pack = getPack(id);
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  if (!pack) {
    return (
      <Screen>
        <Body>Ce pack n'existe plus.</Body>
        <Button title="Retour" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const editable = !pack.builtin;
  const thumb = Math.floor((width - space.md * 2 - space.sm) / 2);
  const previewWidth = Math.min(width - space.md * 4, 420);

  // Le recadrage du sélecteur transforme un GIF en image fixe : on le désactive pour les GIF.
  const pickImage = async (gif: boolean) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: !gif });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setDraft({
      mode: 'new',
      uri: a.uri,
      width: a.width,
      height: a.height,
      mimeType: a.mimeType,
      name: '',
      zones: ZONE_PRESETS[0].zones,
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.mode === 'new') {
        await addTemplate(
          pack.id,
          { uri: draft.uri, width: draft.width, height: draft.height, mimeType: draft.mimeType },
          draft.name,
          draft.zones,
        );
      } else {
        updateTemplate(pack.id, draft.template.id, { name: draft.name.trim() || draft.template.name, zones: draft.zones });
      }
      setDraft(null);
    } catch (e: any) {
      Alert.alert('Oups', `Impossible d'enregistrer l'image (${e?.message ?? e}).`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePack = () =>
    Alert.alert(`Supprimer « ${pack.name} » ?`, 'Toutes ses images seront supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deletePack(pack.id);
          router.back();
        },
      },
    ]);

  const confirmDeleteTemplate = (t: MemeTemplate) =>
    Alert.alert(`Supprimer « ${t.name} » ?`, undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteTemplate(pack.id, t.id);
          setDraft(null);
        },
      },
    ]);

  if (draft) {
    const previewTemplate: MemeTemplate =
      draft.mode === 'new'
        ? { id: 'draft', name: draft.name, aspect: draft.width / draft.height, hasImage: true, zones: draft.zones }
        : { ...draft.template, zones: draft.zones };
    const imageUri = draft.mode === 'new' ? draft.uri : imageFile(draft.template.id, draft.template.gif).uri;
    return (
      <Screen scroll>
        <Title size={28}>{draft.mode === 'new' ? 'Nouveau meme' : 'Modifier le meme'}</Title>
        <View style={{ alignSelf: 'center', borderRadius: radius.md, overflow: 'hidden' }}>
          <MemeView template={previewTemplate} captions={SAMPLE} width={previewWidth} imageUri={imageUri} placeholders />
        </View>
        <Label>Nom (pour s'y retrouver)</Label>
        <TextInput
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          placeholder="Ex : Kevin au réveil"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={40}
        />
        <Label>Où va le texte ?</Label>
        <View style={styles.presets}>
          {ZONE_PRESETS.map((p) => {
            const active = JSON.stringify(p.zones) === JSON.stringify(draft.zones);
            return (
              <Pressable
                key={p.key}
                onPress={() => setDraft({ ...draft, zones: p.zones })}
                style={[styles.preset, active && styles.presetOn]}
              >
                <Text style={[styles.presetText, active && { color: colors.accentText }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button title="Enregistrer" onPress={saveDraft} loading={saving} />
        {draft.mode === 'edit' && (
          <Button title="Supprimer ce meme" variant="danger" onPress={() => confirmDeleteTemplate(draft.template)} />
        )}
        <Button title="Annuler" variant="ghost" onPress={() => setDraft(null)} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {editable ? (
        <TextInput
          defaultValue={pack.name}
          onEndEditing={(e) => renamePack(pack.id, e.nativeEvent.text)}
          style={styles.titleInput}
          maxLength={40}
        />
      ) : (
        <Title>{pack.name}</Title>
      )}
      {editable ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title="Ajouter une image" onPress={() => pickImage(false)} style={{ flex: 1 }} />
          <Button title="Ajouter un GIF" variant="secondary" onPress={() => pickImage(true)} style={{ flex: 1 }} />
        </View>
      ) : (
        <Body muted>Pack intégré à l'app (lecture seule). Crée ton propre pack pour ajouter tes images.</Body>
      )}

      {pack.templates.length === 0 && (
        <Card style={{ alignItems: 'center' }}>
          <Body muted style={{ textAlign: 'center' }}>
            Pack vide. Ajoute des photos depuis ta galerie !
          </Body>
        </Card>
      )}

      <View style={styles.grid}>
        {pack.templates.map((t) => (
          <Pressable
            key={t.id}
            disabled={!editable}
            onPress={() => setDraft({ mode: 'edit', template: t, name: t.name, zones: t.zones })}
            style={styles.thumb}
          >
            <MemeView template={t} captions={[]} width={thumb} imageUri={t.hasImage ? imageFile(t.id, t.gif).uri : null} />
            <Text style={styles.thumbName} numberOfLines={1}>
              {t.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {editable && <Button title="Supprimer le pack" variant="danger" onPress={confirmDeletePack} />}
      <Button title="Retour" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    titleInput: {
      color: colors.text,
      fontSize: 30,
      fontFamily: fonts.display,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: space.xs,
    },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      height: 48,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      fontFamily: fonts.semibold,
    },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    preset: {
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAlt,
    },
    presetOn: { backgroundColor: colors.accent },
    presetText: { color: colors.text, fontFamily: fonts.bold },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    thumb: { backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden', alignSelf: 'flex-start' },
    thumbName: { color: colors.text, padding: space.sm, fontFamily: fonts.semibold, maxWidth: 160 },
  }),
);
