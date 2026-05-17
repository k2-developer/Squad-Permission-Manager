import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
  type Interaction,
  ChannelType,
} from 'discord.js';
import { config } from '../config.js';
import { WhitelistEntry } from '../models/WhitelistEntry.js';
import { invalidateOutputCache } from './whitelist.js';

let client: Client | null = null;

export async function initDiscordBot(): Promise<void> {
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  client.on('ready', () => {
    console.log(`[Discord] Bot logged in as ${client!.user?.tag}`);
    if (!config.discord.approverRoleId) {
      console.warn(
        '[Discord] DISCORD_APPROVER_ROLE_ID is not set — approve/reject buttons are DISABLED. ' +
        'Set this env var to a Discord role ID whose members are allowed to act on whitelist notifications.'
      );
    }
  });

  client.on('interactionCreate', handleInteraction);

  await client.login(config.discord.token);
}

/**
 * Verify the Discord user who clicked a button is in the configured approver role.
 * Falls back to denial if approverRoleId isn't configured — anonymous Discord
 * users must never be able to mutate panel data.
 */
async function isAuthorizedApprover(interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton()) return false;
  if (!config.discord.approverRoleId) return false;
  if (!interaction.guild) return false;

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.roles.cache.has(config.discord.approverRoleId);
  } catch {
    return false;
  }
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isButton()) return;

  const [action, type, id] = interaction.customId.split(':');
  if (action !== 'spm') return;

  // Authorization gate — no Discord user may mutate panel data without
  // the configured approver role.
  const authorized = await isAuthorizedApprover(interaction);
  if (!authorized) {
    try {
      await interaction.reply({
        content: 'You are not authorized to act on whitelist actions.',
        ephemeral: true,
      });
    } catch {
      // interaction may have expired — swallow
    }
    return;
  }

  // Validate id is a 24-hex ObjectId before touching the DB.
  if (!/^[0-9a-f]{24}$/i.test(id ?? '')) {
    try {
      await interaction.reply({ content: 'Invalid action id.', ephemeral: true });
    } catch { /* */ }
    return;
  }

  try {
    if (type === 'wl_approve') {
      const entry = await WhitelistEntry.findByIdAndUpdate(id, { approved: true }, { new: true });
      // Always invalidate — a concurrent UI delete can race ahead of us and
      // null the lookup; the cached INI in either branch is now stale.
      invalidateOutputCache();
      if (entry) {
        await interaction.update({
          content: `Approved by ${interaction.user.tag}`,
          components: [],
        });
      } else {
        await interaction.update({
          content: `Entry no longer exists (already removed).`,
          components: [],
        });
      }
    } else if (type === 'wl_reject') {
      await WhitelistEntry.findByIdAndDelete(id);
      invalidateOutputCache();
      await interaction.update({
        content: `Rejected by ${interaction.user.tag}`,
        components: [],
      });
    }
    // app_accept / app_reject removed with the public-applications feature.
  } catch (err) {
    console.error('[Discord] Interaction error:', err);
    if (interaction.replied || interaction.deferred) return;
    await interaction.reply({ content: 'Error processing action', ephemeral: true });
  }
}

/** Strip Discord-markdown / mention syntax from user-controlled strings. */
function escapeDiscord(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[`*_~|\\]/g, '')
    .replace(/@(everyone|here)/gi, '@​$1')
    .replace(/<@[!&]?\d+>/g, '')
    .slice(0, 256);
}

export function notifyWhitelistAction(
  type: 'pending',
  data: {
    playerName: string;
    steamId64: string;
    groupName: string;
    clanName: string;
    entryId: string;
  }
): void {
  if (!client || !config.discord.notificationChannelId) return;
  // Don't post buttons users can't legitimately use.
  if (!config.discord.approverRoleId) return;

  const channel = client.channels.cache.get(config.discord.notificationChannelId) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('Whitelist Approval Required')
    .setColor(0xf59e0b)
    .addFields(
      { name: 'Player', value: escapeDiscord(data.playerName) || 'N/A', inline: true },
      { name: 'Steam ID', value: escapeDiscord(data.steamId64) || 'N/A', inline: true },
      { name: 'Group', value: escapeDiscord(data.groupName) || 'N/A', inline: true },
      { name: 'Clan', value: escapeDiscord(data.clanName) || 'N/A', inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`spm:wl_approve:${data.entryId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`spm:wl_reject:${data.entryId}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
  );

  channel.send({ embeds: [embed], components: [row] }).catch(console.error);
}

export function getDiscordStatus() {
  return {
    connected: client?.isReady() ?? false,
    username: client?.user?.tag ?? null,
  };
}

export function getDiscordGuilds() {
  if (!client) return [];
  return client.guilds.cache.map((g) => ({ id: g.id, name: g.name, icon: g.iconURL() }));
}

export async function getDiscordChannels(guildId?: string) {
  if (!client) return [];
  const guild = client.guilds.cache.get(guildId || config.discord.guildId);
  if (!guild) return [];
  const channels = await guild.channels.fetch();
  return channels
    .filter((c) => c?.type === ChannelType.GuildText)
    .map((c) => ({ id: c!.id, name: c!.name }));
}

export async function getDiscordRoles(guildId?: string) {
  if (!client) return [];
  const guild = client.guilds.cache.get(guildId || config.discord.guildId);
  if (!guild) return [];
  const roles = await guild.roles.fetch();
  return roles
    .filter((r) => !r.managed && r.name !== '@everyone')
    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));
}
