/**
 * LiveKit Voice Manager - Stable version with audio attach fix
 */

import {
  Room, RoomEvent, Participant, RemoteParticipant, LocalParticipant,
  Track, TrackPublication, RemoteTrackPublication, LocalTrackPublication,
  TrackSource, ConnectionState, DataPacket_Kind, ParticipantEvent, TrackEvent,
} from 'livekit-client';

export interface RemoteStream {
  userId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasScreen: boolean;
  isStreaming: boolean;
  participant: RemoteParticipant;
}

export class LiveKitVoiceManager {
  private room: Room | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private streamStream: MediaStream | null = null;

  private userId: string = '';
  private _cachedStreams: RemoteStream[] = [];
  private serverId: string = '';
  private channelId: string = '';
  private isConnected: boolean = false;
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private joinTimestamp: number = 0;
  private isStreaming: boolean = false;

  private onPeerCountChange?: (count: number) => void;
  private onRemoteStreamsChange?: (streams: RemoteStream[]) => void;
  private onScreenShareStopped?: () => void;
  private onCameraStopped?: () => void;
  private onSpeakingChange?: (isSpeaking: boolean) => void;
  private onStreamingChange?: (isStreaming: boolean) => void;
  private onConnectionStateChange?: (state: ConnectionState) => void;

  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      rtcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    this.setupRoomEventListeners();
  }

  private setupRoomEventListeners() {
    if (!this.room) return;

    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      console.log('[LiveKitVoiceManager] Connection state changed:', state);
      this.onConnectionStateChange?.(state);
      if (state === ConnectionState.Connected) {
        this.isConnected = true; this.joinTimestamp = Date.now(); this.notifyPeerCount();
      } else if (state === ConnectionState.Disconnected) {
        this.isConnected = false; this.notifyPeerCount();
      }
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[LiveKitVoiceManager] Participant connected:', participant.identity);
      this.notifyPeerCount(); this.notifyRemoteStreams();
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('[LiveKitVoiceManager] Participant disconnected:', participant.identity);
      document.getElementById(`lk-audio-${participant.identity}`)?.remove();
      this._cachedStreams = this._cachedStreams.filter(s => s.userId !== participant.identity)
      this.onRemoteStreamsChange?.([...this._cachedStreams])
      this.notifyPeerCount();
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('[LiveKitVoiceManager] Track subscribed:', track.kind, 'from', participant.identity);
      if (track.kind === Track.Kind.Audio) {
        this.attachAudioTrack(track, participant.identity);
        // ✅ ابعت stream مباشرة بدون ما نعتمد على room.participants
        const mt = (track as any).mediaStreamTrack
        const stream = new MediaStream()
        if (mt) stream.addTrack(mt)
        // جيب الـ streams الموجودة وأضف أو حدّث
        this.onRemoteStreamsChange?.([
          ...(this._cachedStreams || []).filter(s => s.userId !== participant.identity),
          { userId: participant.identity, stream, hasVideo: false, hasScreen: false, isStreaming: false, participant }
        ])
        this._cachedStreams = [
          ...(this._cachedStreams || []).filter(s => s.userId !== participant.identity),
          { userId: participant.identity, stream, hasVideo: false, hasScreen: false, isStreaming: false, participant }
        ]
        console.log('[LiveKitVoiceManager] Streams after subscribe:', this._cachedStreams.length)
      } else {
        this.notifyRemoteStreams();
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('[LiveKitVoiceManager] Track unsubscribed:', track.kind, 'from', participant.identity);
      if (track.kind === Track.Kind.Audio) {
        document.getElementById(`lk-audio-${participant.identity}`)?.remove();
        this._cachedStreams = this._cachedStreams.filter(s => s.userId !== participant.identity)
        this.onRemoteStreamsChange?.([...this._cachedStreams])
      } else {
        this.notifyRemoteStreams();
      }
    });

    this.room.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: Participant) => {
      this.notifyRemoteStreams();
    });

    this.room.on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: Participant) => {
      this.notifyRemoteStreams();
    });

    this.room.localParticipant.on(ParticipantEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
      console.log('[LiveKitVoiceManager] Local track published:', publication.kind);
    });

    this.room.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
      console.log('[LiveKitVoiceManager] Local track unpublished:', publication.kind);
    });
  }

  // ✅ Attach audio track مباشرة لـ DOM
  private attachAudioTrack(track: any, identity: string) {
    try {
      document.getElementById(`lk-audio-${identity}`)?.remove();
      const audioEl = document.createElement('audio');
      audioEl.id = `lk-audio-${identity}`;
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      document.body.appendChild(audioEl);

      if (typeof track.attach === 'function') {
        track.attach(audioEl);
        console.log('[LiveKitVoiceManager] Audio attached via .attach() for:', identity);
      } else if (track.mediaStreamTrack) {
        audioEl.srcObject = new MediaStream([track.mediaStreamTrack]);
        console.log('[LiveKitVoiceManager] Audio attached via srcObject for:', identity);
      }
      audioEl.play().catch(e => console.warn('[LiveKitVoiceManager] Audio play failed:', e));
    } catch (e) {
      console.warn('[LiveKitVoiceManager] Audio attach failed:', e);
    }
  }

  setCallbacks(callbacks: {
    onPeerCountChange?: (count: number) => void;
    onRemoteStreamsChange?: (streams: RemoteStream[]) => void;
    onScreenShareStopped?: () => void;
    onCameraStopped?: () => void;
    onSpeakingChange?: (isSpeaking: boolean) => void;
    onStreamingChange?: (isStreaming: boolean) => void;
    onConnectionStateChange?: (state: ConnectionState) => void;
  }) {
    this.onPeerCountChange = callbacks.onPeerCountChange;
    this.onRemoteStreamsChange = callbacks.onRemoteStreamsChange;
    // ✅ لو فيه cached streams → ابعتها فوراً
    if (callbacks.onRemoteStreamsChange && this._cachedStreams.length > 0) {
      callbacks.onRemoteStreamsChange([...this._cachedStreams])
    }
    this.onScreenShareStopped = callbacks.onScreenShareStopped;
    this.onCameraStopped = callbacks.onCameraStopped;
    this.onSpeakingChange = callbacks.onSpeakingChange;
    this.onStreamingChange = callbacks.onStreamingChange;
    this.onConnectionStateChange = callbacks.onConnectionStateChange;
  }

  private notifyPeerCount() {
    if (!this.room || !this.room.participants) { this.onPeerCountChange?.(0); return; }
    const count = Array.from(this.room.participants.values()).length + 1;
    this.onPeerCountChange?.(count);
  }

  private notifyRemoteStreams() {
    // ✅ LiveKit v2: جرب remoteParticipants أول ثم participants
    const participants: Map<string, RemoteParticipant> =
      (this.room as any)?.remoteParticipants ||
      (this.room as any)?.participants ||
      new Map()
    if (!this.room || participants.size === 0) { this.onRemoteStreamsChange?.([]); return; }
    const streams: RemoteStream[] = [];
    for (const [identity, participant] of participants) {
      const audioTrackPub = participant.getTrackPublication(Track.Source.Microphone);
      const videoTrack = participant.getTrackPublication(Track.Source.Camera);
      const screenTrack = participant.getTrackPublication(Track.Source.ScreenShare);
      const screenVideoTrack = participant.getTrackPublication(Track.Source.ScreenShareVideo);
      const stream = new MediaStream();
      if (audioTrackPub?.track?.mediaStreamTrack) {
        const mt = audioTrackPub.track.mediaStreamTrack;
        if (!mt.enabled) mt.enabled = true;
        stream.addTrack(mt);
      }
      if (videoTrack?.track?.mediaStreamTrack) stream.addTrack(videoTrack.track.mediaStreamTrack);
      if (screenVideoTrack?.track?.mediaStreamTrack) stream.addTrack(screenVideoTrack.track.mediaStreamTrack);
      streams.push({ userId: identity, stream, hasVideo: !!videoTrack?.track, hasScreen: !!(screenTrack || screenVideoTrack), isStreaming: false, participant });
    }
    this.onRemoteStreamsChange?.(streams);
  }

  async join(userId: string, serverId: string, channelId: string, token: string, existingStream?: MediaStream): Promise<MediaStream> {
    if (this.isConnected) await this.leave();

    this.userId = userId; this.serverId = serverId; this.channelId = channelId;

    if (existingStream) {
      this.localStream = existingStream;
    } else {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        console.log('[LiveKitVoiceManager] Got audio stream with', this.localStream.getAudioTracks().length, 'tracks');
      } catch (err) {
        console.warn('[LiveKitVoiceManager] Microphone unavailable:', err);
        try {
          const audioContext = new AudioContext();
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          gain.gain.value = 0;
          oscillator.connect(gain);
          const dest = audioContext.createMediaStreamDestination();
          gain.connect(dest); oscillator.start();
          this.localStream = dest.stream;
        } catch { this.localStream = new MediaStream(); }
      }
    }

    try {
      console.log('[LiveKitVoiceManager] Connecting to room:', import.meta.env.VITE_LIVEKIT_WS_URL);
      await this.room!.connect(import.meta.env.VITE_LIVEKIT_WS_URL || 'ws://localhost:7880', token);
      console.log('[LiveKitVoiceManager] Connected to room, publishing tracks');

      await new Promise(resolve => setTimeout(resolve, 100));

      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        console.log('[LiveKitVoiceManager] Available audio tracks:', audioTracks.length);
        if (audioTracks.length > 0) {
          const audioTrack = audioTracks[0];
          console.log('[LiveKitVoiceManager] Publishing audio track, enabled:', audioTrack.enabled);
          try {
            const trackPublication = await this.room!.localParticipant.publishTrack(audioTrack, {
              source: Track.Source.Microphone, simulcast: false,
            });
            console.log('[LiveKitVoiceManager] Audio track published successfully:', trackPublication.trackSid);
          } catch (pubErr) {
            console.error('[LiveKitVoiceManager] Failed to publish audio track:', pubErr);
          }
        } else {
          console.warn('[LiveKitVoiceManager] No audio tracks found in local stream');
        }
      } else {
        console.warn('[LiveKitVoiceManager] No local stream available');
      }

      return this.localStream!;
    } catch (error) {
      console.error('[LiveKitVoiceManager] Failed to join room:', error);
      this.isConnected = false; this.notifyPeerCount(); this.notifyRemoteStreams();
      throw error;
    }
  }

  async leave() {
    if (!this.room) return;
    // ✅ امسح كل الـ audio elements
    document.querySelectorAll('audio[id^="lk-audio-"]').forEach(el => el.remove());
    this._cachedStreams = [];
    this.stopAllLocalTracks();
    await this.room.disconnect();
    this.isConnected = false;
    this.onPeerCountChange?.(0);
    this.onRemoteStreamsChange?.([]);
  }

  private stopAllLocalTracks() {
    if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; this.onScreenShareStopped?.(); }
    if (this.cameraStream) { this.cameraStream.getTracks().forEach(t => t.stop()); this.cameraStream = null; this.onCameraStopped?.(); }
    if (this.streamStream) { this.streamStream.getTracks().forEach(t => t.stop()); this.streamStream = null; this.isStreaming = false; this.onStreamingChange?.(false); }
    if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.room) {
      const audioPublication = this.room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (audioPublication) { if (muted) audioPublication.mute(); else audioPublication.unmute(); }
    }
  }

  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    if (this.room && this.room.participants) {
      try {
        for (const participant of this.room.participants.values()) {
          const audioPub = participant.getTrackPublication(Track.Source.Microphone);
          if (audioPub?.track) audioPub.track.mediaStreamTrack.enabled = !deafened;
        }
      } catch (error) { console.warn('[LiveKitVoiceManager] Error setting deafened state:', error); }
    }
    // ✅ برضو افصل الـ audio elements
    document.querySelectorAll<HTMLAudioElement>('audio[id^="lk-audio-"]').forEach(el => { el.muted = deafened; });
  }

  mutePeer(userId: string) {
    if (!this.room) return;
    const participant = this.room.participants.get(userId);
    if (participant) { const audioPub = participant.getTrackPublication(Track.Source.Microphone); if (audioPub?.track) audioPub.track.mediaStreamTrack.enabled = false; }
  }

  unmutePeer(userId: string) {
    if (!this.room) return;
    const participant = this.room.participants.get(userId);
    if (participant) { const audioPub = participant.getTrackPublication(Track.Source.Microphone); if (audioPub?.track) audioPub.track.mediaStreamTrack.enabled = !this.isDeafened; }
  }

  isPeerMuted(userId: string): boolean {
    if (!this.room) return false;
    const participant = this.room.participants.get(userId);
    if (participant) { const audioPub = participant.getTrackPublication(Track.Source.Microphone); return audioPub?.isMuted ?? false; }
    return false;
  }

  async startScreenShare(): Promise<MediaStream | null> {
    if (!this.room || !this.isConnected) return null;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.screenStream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) { await this.room.localParticipant.publishTrack(videoTrack, { source: Track.Source.ScreenShareVideo, name: 'screen-video' }); }
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) { await this.room.localParticipant.publishTrack(audioTrack, { source: Track.Source.ScreenShare, name: 'screen-audio' }); }
      stream.getVideoTracks()[0].addEventListener('ended', () => { this.stopScreenShare(); });
      return stream;
    } catch (error) { console.error('[LiveKitVoiceManager] Failed to start screen share:', error); return null; }
  }

  async stopScreenShare() {
    if (!this.room) return;
    const screenVideoPub = this.room.localParticipant.getTrackPublication(Track.Source.ScreenShareVideo);
    const screenAudioPub = this.room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (screenVideoPub) await this.room.localParticipant.unpublishTrack(screenVideoPub.track!);
    if (screenAudioPub) await this.room.localParticipant.unpublishTrack(screenAudioPub.track!);
    if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; }
    this.onScreenShareStopped?.();
  }

  async startCamera(): Promise<MediaStream | null> {
    if (!this.room || !this.isConnected) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.cameraStream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) { await this.room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera }); }
      return stream;
    } catch (error) { console.error('[LiveKitVoiceManager] Failed to start camera:', error); return null; }
  }

  async stopCamera() {
    if (!this.room) return;
    const cameraPub = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (cameraPub) await this.room.localParticipant.unpublishTrack(cameraPub.track!);
    if (this.cameraStream) { this.cameraStream.getTracks().forEach(t => t.stop()); this.cameraStream = null; }
    this.onCameraStopped?.();
  }

  getRoom(): Room | null { return this.room; }
  getLocalParticipant(): LocalParticipant | null { return this.room?.localParticipant || null; }
  getRemoteParticipants(): RemoteParticipant[] { return this.room?.participants ? Array.from(this.room.participants.values()) : []; }
  getConnectionState(): ConnectionState { return this.room?.connectionState || ConnectionState.Disconnected; }
  getJoinedAt(): number { return this.joinTimestamp; }
  getServerId(): string { return this.serverId; }
  getChannelId(): string { return this.channelId; }
}

export const livekitVoiceManager = new LiveKitVoiceManager();
