let feedbackStore: any[] = [];

export const getFeedback = () => feedbackStore;

export const addFeedback = (data: any) => {
    feedbackStore.push(data);
};
