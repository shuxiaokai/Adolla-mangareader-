// This file will return an array of "announcements"

import chalk from "chalk";
import fetch from "node-fetch-extra";
import db from "../db";
import secretConfig from "./secretConfig";
import Bot from "./bot";
import { months } from "../routers/settings";

const gistUrl =
	"https://gist.githubusercontent.com/JipFr/df06901f3a2c1990a91e7a1aadc16129/raw";

export interface Announcement {
	message: string;
	date: string;
	importance: 0 | 1;
	id: number;
	priority: number;
	readableDate?: string;
}

let data: { at: number; data: Announcement[] } = {
	at: 0,
	data: [],
};

export async function getAnnouncements(): Promise<Announcement[]> {
	// See if announcement cache is valid or not
	const diff = Date.now() - data.at;
	if (diff > 1e3 * 60 * 30) {
		data.data = await (await fetch(gistUrl)).json();
		data.at = Date.now();
	}

	const notifiedAnnouncements = db.get("other.announcements-sent") || [];
	const dismissedAnnouncements = db.get("other.announcements-dismissed") || [];

	for (const announcement of data.data) {
		const d = new Date(announcement.date);
		const fmtDate = `${months[
			d.getMonth()
		].toLowerCase()} ${d.getDate()} ${d.getFullYear()}`;
		announcement.readableDate = fmtDate;

		// Notify people
		if (!notifiedAnnouncements.includes(announcement.id)) {
			const bot = Bot.get();
			if (bot) {
				// Send notification, and do some stuff to make sure it doesn't send it every 30 minutes
				console.info(
					chalk.green("[NOTIFS]") +
						` New announcement: ${announcement.message}, notifying user with Telegram bot`
				);

				Bot.send(`**Word has come from The Creator:** ${announcement.message}`);
			}

			// Discord webhook
			if (secretConfig.discord_webhook) {
				console.info(
					chalk.green("[NOTIFS]") +
						` New announcement: ${announcement.message}, notifying user over Discord Webhook`
				);

				await fetch(secretConfig.discord_webhook, {
					method: "POST",
					headers: {
						"content-type": "application/json",
					},
					body: JSON.stringify({
						avatar_url:
							"https://raw.githubusercontent.com/AdollaApp/Adolla/master/public/icons/white-on-blue.png",
						username: "Adolla",
						embeds: [
							{
								title: "The Creator has spoken:",
								description: announcement.message,
								color: 4959182,
								author: {
									name: "Adolla",
									url: "https://jipfr.nl/adolla",
									icon_url:
										"https://raw.githubusercontent.com/AdollaApp/Adolla/master/public/icons/white-on-blue.png",
								},
							},
						],
					}),
				});
			}

			notifiedAnnouncements.push(announcement.id);
		}
	}

	db.set("other.announcements-sent", notifiedAnnouncements);

	// Unread announcements
	const unreadAnnouncements = data.data.filter((announcement) => {
		return !dismissedAnnouncements.includes(announcement.id);
	});

	return unreadAnnouncements;
}
