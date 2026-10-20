import type { ReactNode } from "react";
import { ArrowLeft, Flame, LockKeyhole, Trophy } from "lucide-react";
import Modal from "./Modal";
import { Avatar } from "./Avatar";
import { ProfileCover } from "./ProfileCosmetics";
import AchievementMedal from "./AchievementMedal";
import { accountConfigured, backendRpc } from "./backend";
import { blankProfile } from "./profile";
import { readFriendProfile } from "./friendProfile";
import { useSyncedResource } from "./useSyncedResource";

export default function FriendProfile({
  userId,
  friendId,
  nickname,
  onClose,
  presentation = "modal",
  children,
}: {
  userId: string;
  friendId: string;
  nickname: string;
  onClose: () => void;
  presentation?: "modal" | "panel";
  children?: ReactNode;
}) {
  // Private friendship-scoped data stays in memory, never in persistent cache.
  const profile = useSyncedResource({
    userId,
    resource: "showcase",
    queryKey: `get_friend_showcase:${friendId}`,
    enabled: Boolean(userId && accountConfigured),
    read: () => backendRpc("get_friend_showcase", { p_user: friendId }),
    parse: readFriendProfile,
  });
  const data = profile.state;
  const content = (
    <div className="friend-profile">
      {profile.sync.initialLoading && <p role="status">Carregando perfil…</p>}
      {profile.error && (
        <div className="friend-profile-error" role="alert">
          <p>{profile.error}</p>
          <button
            className="secondary-button"
            disabled={profile.busy}
            onClick={() => void profile.refresh()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {data && !profile.error && (
        <>
          <article
            className="profile-identity"
            aria-label="Identidade do amigo"
          >
            <div className="profile-banner">
              <ProfileCover banner={data.banner} />
            </div>
            <div className="profile-identity-main">
              <div className="profile-identity-toolbar">
                <div className="profile-portrait">
                  <Avatar
                    profile={
                      data.avatar ?? {
                        ...blankProfile(),
                        nickname: data.nickname,
                      }
                    }
                    size={84}
                    frame={data.frame}
                  />
                </div>
              </div>
              <div className="profile-identity-copy">
                <h3>{data.displayName || data.nickname}</h3>
                <p className="profile-handle">
                  <LockKeyhole size={13} aria-hidden="true" />@{data.nickname}
                </p>
              </div>
            </div>
          </article>
          {children}
          {data.streak ? (
            <dl className="friend-profile-stats" aria-label="Ofensiva do amigo">
              <div>
                <dt>
                  <Flame size={18} aria-hidden="true" />
                  Ofensiva atual
                </dt>
                <dd>
                  {data.streak.current} <small>pontos</small>
                </dd>
              </div>
              <div>
                <dt>
                  <Trophy size={18} aria-hidden="true" />
                  Recorde
                </dt>
                <dd>
                  {data.streak.best} <small>pontos</small>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="friend-profile-empty">Ofensiva indisponível</p>
          )}
          <section aria-label="Medalhas em destaque">
            <h3>Medalhas em destaque</h3>
            {data.badges.length ? (
              <ul className="friend-profile-badges">
                {data.badges.map((badge) => (
                  <li key={badge.key}>
                    <AchievementMedal
                      icon={badge.icon}
                      medalKey={badge.medalKey}
                      rarity={badge.rarity}
                    />
                    <div>
                      <strong>{badge.name}</strong>
                      {badge.earnedAt && (
                        <time dateTime={badge.earnedAt}>
                          {new Date(badge.earnedAt).toLocaleDateString("pt-BR")}
                        </time>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="friend-profile-empty">
                Nenhuma medalha compartilhada
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
  return presentation === "panel" ? (
    <section
      className="arena-detail-panel arena-rival-panel"
      aria-label={`Ficha de ${nickname}`}
    >
      <div className="arena-detail-heading">
        <button
          className="icon-button"
          aria-label="Voltar para amigos"
          onClick={onClose}
        >
          <ArrowLeft size={21} />
        </button>
        <div>
          <span className="arena-kicker">RIVAL</span>
          <h2 id="friend-detail-heading" tabIndex={-1}>
            @{nickname}
          </h2>
        </div>
      </div>
      {content}
    </section>
  ) : (
    <Modal
      title={`Perfil de ${nickname}`}
      onClose={onClose}
      compactHeader
      centered
      dismissible={false}
    >
      {content}
    </Modal>
  );
}
