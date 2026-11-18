import { Image, Text, View } from 'react-native';
import { GameClient } from '../net/GameClient';
import { PublicPlayer } from '../shared/types';
import { useAsset } from './MemeView';
import { colors, fonts } from './theme';

/** Rond avec la photo de profil, ou l'initiale du pseudo si pas de photo. */
export function Avatar({ uri, name, size = 32, ring }: { uri?: string | null; name: string; size?: number; ring?: boolean }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? Math.max(2, size * 0.05) : 0,
        borderColor: colors.accent2,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ color: colors.accentText, fontFamily: fonts.display, fontSize: size * 0.5, lineHeight: size * 0.62 }}>
          {initial}
        </Text>
      )}
    </View>
  );
}

/** Avatar d'un joueur de la partie (photo récupérée auprès de l'hôte). */
export function PlayerAvatar({ client, player, size }: { client: GameClient; player: PublicPlayer; size?: number }) {
  const uri = useAsset(client, player.avatarId);
  return <Avatar uri={uri} name={player.name} size={size} />;
}
