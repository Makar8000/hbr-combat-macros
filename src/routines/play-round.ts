import { TURN_READY, waitFor } from "../game/conditions.ts";
import { CONTROLS } from "../game/controls.ts";
import { describeRound, type GameRound } from "../models/game-round.ts";
import { tapWithDelay } from "../platform/keyboard.ts";
import { overdrive } from "./overdrive.ts";

export async function playRound(round: GameRound): Promise<void> {
  await waitFor(TURN_READY);
  console.log(`▶️ ${describeRound(round)}`);

  const od = round.overdrive;
  const odBefore = typeof od === "number" && od < 0;
  const odAfter = typeof od === "number" && od > 0;

  if (od === "ALT") {
    console.log("✨ Activating Alt Skill");
    await tapWithDelay(CONTROLS.altSkill);
    await tapWithDelay(CONTROLS.confirm);
    await Bun.sleep(5000); // wait for the animation
  }
  if (odBefore) await overdrive(od);

  // Position 0 means no character action, only end the turn if execute is set.
  if (round.position === 0) {
    if (round.execute) {
      await tapWithDelay(CONTROLS.confirm);
      if (odAfter) await overdrive(od);
    }
    return;
  }

  await tapWithDelay(String(round.position));

  if (round.swap) {
    if (round.sequence) await tapWithDelay(String(round.sequence.major));
  } else {
    if (round.sequence) {
      // X.Y is Down X times then Tab Y times. A plain X is only Down X times.
      for (let i = 0; i < round.sequence.major; i++) {
        await tapWithDelay(CONTROLS.menuDown, 0.3);
      }
      for (let i = 0; i < (round.sequence.minor ?? 0); i++) {
        await tapWithDelay(CONTROLS.switchSkill);
      }
    }
    await tapWithDelay(CONTROLS.confirm, 0.65);

    const target = round.targetPosition;
    if (target !== null && target >= 1 && target <= 6) {
      await tapWithDelay(String(target));
    }
  }

  if (round.execute) {
    await tapWithDelay(CONTROLS.confirm);
    if (odAfter) {
      await Bun.sleep(2500);
      await overdrive(od);
    }
  }
}
