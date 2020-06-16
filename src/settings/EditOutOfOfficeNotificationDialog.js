//@flow
import m from "mithril"
import {Dialog} from "../gui/base/Dialog"
import {DatePicker} from "../gui/base/DatePicker"
import {getStartOfTheWeekOffsetForUser} from "../calendar/CalendarUtils"
import {HtmlEditor} from "../gui/base/HtmlEditor"
import type {OutOfOfficeNotification} from "../api/entities/tutanota/OutOfOfficeNotification"
import {createOutOfOfficeNotification} from "../api/entities/tutanota/OutOfOfficeNotification"
import {logins} from "../api/main/LoginController"
import type {GroupMembership} from "../api/entities/sys/GroupMembership"
import {TextFieldN} from "../gui/base/TextFieldN"
import stream from "mithril/stream/stream.js"
import {lang} from "../misc/LanguageViewModel"
import {locator} from "../api/main/MainLocator"
import {Keys, OUT_OF_OFFICE_SUBJECT_PREFIX, OutOfOfficeNotificationMessageType} from "../api/common/TutanotaConstants"
import {DropDownSelector} from "../gui/base/DropDownSelector"
import {CheckboxN} from "../gui/base/CheckboxN"
import type {CheckboxAttrs} from "../gui/base/CheckboxN"
import type {OutOfOfficeNotificationMessage} from "../api/entities/tutanota/OutOfOfficeNotificationMessage"
import {createOutOfOfficeNotificationMessage} from "../api/entities/tutanota/OutOfOfficeNotificationMessage"
import {px} from "../gui/size"
import {ButtonType} from "../gui/base/ButtonN"

class NotificationData {
	outOfOfficeNotification: OutOfOfficeNotification
	mailMembership: GroupMembership
	enabled: Stream<boolean>
	outOfOfficeStartTimePicker: DatePicker
	outOfOfficeEndTimePicker: DatePicker
	organizationSubject: Stream<string>
	defaultSubject: Stream<string>
	organizationOutOfOfficeEditor: HtmlEditor
	defaultOutOfOfficeEditor: HtmlEditor
	timeRangeEnabled: Stream<boolean> = stream(false)
	organizationMessageEnabled: Stream<boolean> = stream(false)
	defaultMessageEnabled: Stream<boolean> = stream(true)
	initialSetup: boolean

	constructor(outOfOfficeNotification: ?OutOfOfficeNotification) {
		if (!outOfOfficeNotification) {
			this.outOfOfficeNotification = createOutOfOfficeNotification()
			this.initialSetup = true
		} else {
			this.outOfOfficeNotification = outOfOfficeNotification
			this.initialSetup = false
		}
		this.mailMembership = getMailMembership()
		this.enabled = stream(false)
		this.outOfOfficeStartTimePicker = new DatePicker(getStartOfTheWeekOffsetForUser(), "dateFrom_label")
		this.outOfOfficeEndTimePicker = new DatePicker(getStartOfTheWeekOffsetForUser(), "dateTo_label")
		this.organizationSubject = stream(lang.get("outOfOfficeDefaultSubject_msg"))
		this.defaultSubject = stream(lang.get("outOfOfficeDefaultSubject_msg"))
		this.organizationOutOfOfficeEditor = new HtmlEditor("message_label", {enabled: true})
			.setMinHeight(100)
			.showBorders()
			.setValue(lang.get("outOfOfficeDefault_msg"))
		this.defaultOutOfOfficeEditor = new HtmlEditor("message_label", {enabled: true})
			.setMinHeight(100)
			.showBorders()
			.setValue(lang.get("outOfOfficeDefault_msg"))
		this.outOfOfficeStartTimePicker.setDate(new Date())
		if (outOfOfficeNotification) {
			this.enabled(outOfOfficeNotification.enabled)
			let defaultEnabled = false
			outOfOfficeNotification.notifications.forEach((notification) => {
				if (notification.type === OutOfOfficeNotificationMessageType.Default) {
					defaultEnabled = true
					this.defaultSubject(notification.subject)
					this.defaultOutOfOfficeEditor.setValue(notification.message)
				} else if (notification.type === OutOfOfficeNotificationMessageType.SameOrganization) {
					this.organizationMessageEnabled(true)
					this.organizationSubject(notification.subject)
					this.organizationOutOfOfficeEditor.setValue(notification.message)
				}
			})
			this.defaultMessageEnabled(defaultEnabled)
			if (outOfOfficeNotification.startTime) {
				this.timeRangeEnabled(true)
				this.outOfOfficeStartTimePicker.setDate(outOfOfficeNotification.startTime)
				this.outOfOfficeEndTimePicker.setDate(outOfOfficeNotification.endTime)
			}
		}
		this.organizationMessageEnabled.map(enabled => {
			if (!enabled) {
				this.defaultMessageEnabled(true)
			}
		})
		this.defaultMessageEnabled.map(enabled => {
			if (!enabled) {
				this.organizationMessageEnabled(true)
			}
		})
	}

	/**
	 * Return OutOfOfficeNotification created from input data or null if invalid.
	 * Shows error dialogs if invalid.
	 * */
	getNotificationFromData(): ?OutOfOfficeNotification {
		let startTime: ?Date = this.timeRangeEnabled() ? this.outOfOfficeStartTimePicker.date() : null
		let endTime: ?Date = this.timeRangeEnabled() ? this.outOfOfficeEndTimePicker.date() : null
		if (this.timeRangeEnabled() && (!startTime || (endTime && (startTime.getTime() > endTime.getTime() || endTime.getTime()
			< Date.now())))) {
			Dialog.error("invalidTimePeriod_msg")
			return null
		}
		const notificationMessages: OutOfOfficeNotificationMessage[] = []
		if (this.defaultMessageEnabled()) {
			const defaultNotification: OutOfOfficeNotificationMessage = createOutOfOfficeNotificationMessage({
				subject: this.defaultSubject(),
				message: this.defaultOutOfOfficeEditor.getValue(),
				type: OutOfOfficeNotificationMessageType.Default
			})
			notificationMessages.push(defaultNotification)
		}
		if (this.organizationMessageEnabled()) {
			const organizationNotification: OutOfOfficeNotificationMessage = createOutOfOfficeNotificationMessage({
				subject: this.organizationSubject(),
				message: this.organizationOutOfOfficeEditor.getValue(),
				type: OutOfOfficeNotificationMessageType.SameOrganization
			})
			notificationMessages.push(organizationNotification)
		}
		if (!notificationMessagesAreValid(notificationMessages)) {
			Dialog.error("outOfOfficeMessageInvalid_msg")
			return null
		}
		this.outOfOfficeNotification._ownerGroup = this.mailMembership.group
		this.outOfOfficeNotification.enabled = this.enabled()
		this.outOfOfficeNotification.startTime = startTime
		this.outOfOfficeNotification.endTime = endTime
		this.outOfOfficeNotification.notifications = notificationMessages
		return this.outOfOfficeNotification
	}
}

export function showEditOutOfOfficeNotificationDialog(outOfOfficeNotification: ?OutOfOfficeNotification) {
	const notificationData = new NotificationData(outOfOfficeNotification)
	const statusItems = [
		{
			name: lang.get("notificationsDisabled_label"),
			value: false
		},
		{
			name: lang.get("notificationsEnabled_label"),
			value: true
		}
	]
	const timeRangeCheckboxAttrs: CheckboxAttrs = {
		label: () => lang.get("outOfOfficeTimeRange_msg"),
		checked: notificationData.timeRangeEnabled,
		helpLabel: () => lang.get("outOfOfficeTimeRangeHelp_msg"),
	}
	const organizationMessageCheckboxAttrs: CheckboxAttrs = {
		label: () => lang.get("outOfOfficeEnableInternal_msg"),
		checked: notificationData.organizationMessageEnabled,
		helpLabel: () => lang.get("outOfOfficeEnableInternalHelp_msg"),
	}
	const defaultMessageCheckboxAttrs: CheckboxAttrs = {
		label: () => lang.get("outOfOfficeEnableExternal_msg"),
		checked: notificationData.defaultMessageEnabled,
		helpLabel: () => lang.get("outOfOfficeEnableExternalHelp_msg"),
	}
	const statusSelector: DropDownSelector<boolean> = new DropDownSelector("state_label", null, statusItems, notificationData.enabled)

	const childForm = {
		view: () => {
			return [
				m(".h4.text-center.mt", lang.get("configuration_label")),
				m(".mt", lang.get("outOfOfficeExplanation_msg")),
				m(statusSelector),
				m(".mt.flex-start", m(CheckboxN, timeRangeCheckboxAttrs)),
				notificationData.timeRangeEnabled()
					? m(".flex-start", [
						m(notificationData.outOfOfficeStartTimePicker), m(notificationData.outOfOfficeEndTimePicker)
					])
					: null,
				m(".mt.flex-start", m(CheckboxN, organizationMessageCheckboxAttrs)),
				m(".mt.flex-start", m(CheckboxN, defaultMessageCheckboxAttrs)), // TODO organizationMessageEnabled() ? .. : null
				notificationData.defaultMessageEnabled()
					? [
						m(".h4.text-center.mt", getDefaultNotificationLabel(notificationData.organizationMessageEnabled())),
						m(TextFieldN, {
								label: "subject_label",
								value: notificationData.defaultSubject,
								injectionsLeft: () => m(".flex-no-grow-no-shrink-auto.pr-s", {
									style: {
										'line-height': px(24),
										opacity: '1'
									}
								}, OUT_OF_OFFICE_SUBJECT_PREFIX)
							}
						),
						m(notificationData.defaultOutOfOfficeEditor)
					]
					: null,
				notificationData.organizationMessageEnabled()
					? [
						m(".h4.text-center.mt", lang.get("outOfOfficeInternal_msg")),
						m(TextFieldN, {
								label: "subject_label",
								value: notificationData.organizationSubject,
								injectionsLeft: () => m(".flex-no-grow-no-shrink-auto.pr-s", {
									style: {
										'line-height': px(24),
										opacity: '1'
									}
								}, OUT_OF_OFFICE_SUBJECT_PREFIX)
							}
						),
						m(notificationData.organizationOutOfOfficeEditor)
					]
					: null,
				m(".pb", "")
			]
		}
	}

	const saveOutOfOfficeNotification = () => {
		const sendableNotification = notificationData.getNotificationFromData()
		// Error messages are already shown if sendableNotification is null. We do not close the dialog.
		if (sendableNotification) {
			const requestPromise = outOfOfficeNotification
				? locator.entityClient.update(sendableNotification)
				: locator.entityClient.setup(null, sendableNotification)
			// If the request fails the user should have to close manually. Otherwise the input data would be lost.
			requestPromise.then(() => cancel()).catch(e => Dialog.error(() => e.toString()))
		}
	}

	function cancel() {
		dialog.close()
	}

	const dialogHeaderAttrs = {
		left: [{label: "cancel_action", click: cancel, type: ButtonType.Secondary}],
		right: [{label: "ok_action", click: saveOutOfOfficeNotification, type: ButtonType.Primary}],
		middle: () => lang.get("outOfOfficeNotification_title"),
	}
	const dialog = Dialog.largeDialog(dialogHeaderAttrs, childForm).addShortcut({
		key: Keys.ESC,
		exec: cancel,
		help: "close_alt"
	}).addShortcut({
		key: Keys.S,
		ctrl: true,
		exec: saveOutOfOfficeNotification,
		help: "ok_action"
	})
	dialog.show()
}

function notificationMessagesAreValid(messages: OutOfOfficeNotificationMessage[]): boolean {
	if (messages.length < 1 || messages.length > 2) {
		return false
	}
	let result = true
	messages.forEach((message) => {
		if (message.subject === "" || message.message === "") {
			result = false
		}
	})
	return result
}

/**
 *
 * @param organizationMessageEnabled true if a special messagesfor senders from the same organization is setup
 * @returns {string} the label for default notifications (depends on whether only default notifications or both default and same organization notifications are enabled)
 */
export function getDefaultNotificationLabel(organizationMessageEnabled: boolean): string {
	if (organizationMessageEnabled) {
		return lang.get("outOfOfficeExternal_msg")
	} else {
		return lang.get("outOfOfficeEveryone_msg")
	}
}

export function getMailMembership(): GroupMembership {
	return logins.getUserController().getMailGroupMemberships()[0] //TODO is this always correct?
}

/**
 * Returns true if notifications will be sent now or at some point in the future.
 * */
export function isNotificationReallyEnabled(notification: OutOfOfficeNotification): boolean {
	return notification.enabled && (!notification.startTime || !notification.endTime || notification.endTime.getTime() > Date.now())
}